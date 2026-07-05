// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function decimals() external view returns (uint8);
}

interface IERC7984Wrapper {
    function wrap(address to, uint256 amount) external returns (euint64);
    function confidentialTransfer(address to, euint64 amount) external returns (euint64);
    function confidentialBalanceOf(address account) external view returns (euint64);
    function underlying() external view returns (address);
    function rate() external view returns (uint256);
}

interface IOracleAdapter {
    // TWAP when the window has ≥2 observations, else a fresh staleness-guarded spot read.
    // mode: 0 = TWAP, 1 = spot(primary), 2 = spot(secondary).
    function settlementPrice(uint64 fromTs, uint64 toTs) external view returns (uint64 price1e6, uint8 mode);
}

/// @title ConfidentialNoteV4 (audit-hardened C3 core)
/// @notice Capped call-spread confidential note. Reserve is funded by WRAPPING public USDC into
/// confidential cUSDT (reverts on shortfall — no phantom credit). Terms encrypted; only the public
/// bound (principal+cap) is public. payoff = principal + min(cap, leverage·max(0, refEnd−strike)),
/// branchless on euint64. claim() pays the encrypted payoff out of the reserve via ERC-7984 transfer.
///
/// Audit fixes vs V3:
///  - H1 settlement liveness: settle() uses oracle.settlementPrice (TWAP-or-spot-fallback), so an
///    unsampled window can no longer permanently lock a note — it settles as long as any source is fresh.
///  - H2 auditor grant: allowReserveTo is owner-gated (was permissionless + non-revocable).
///  - M1: dropped the unused encrypted `notional` (dead state / wasted handle).
contract ConfidentialNoteV4 is ZamaEthereumConfig {
    uint64 public constant MAX_LEVERAGE = 1_000_000;
    uint64 public constant MAX_DELTA = 1_000_000_000_000; // 1e12, 1e6-scaled

    address public immutable owner; // auditor-grant gate (H2)
    IERC20 public immutable usdc; // public underlying (USDC mock, 6 dp)
    IERC7984Wrapper public immutable cUSDT; // confidential wrapper (rate 1, 6 dp) — the reserve token
    IOracleAdapter public immutable oracle;

    struct Note {
        address issuer;
        address holder;
        uint64 principal;
        uint64 cap;
        euint64 strike;
        euint64 leverage;
        uint64 windowStart;
        uint64 windowEnd;
        uint64 refEnd;
        uint8 settleMode; // 0 TWAP / 1 spot-primary / 2 spot-secondary (public settlement provenance)
        bool settled;
        bool claimed;
        euint64 payoff;
    }

    mapping(uint256 => Note) public notes;
    uint256 public noteCount;

    // PUBLIC solvency accounting — only mutated alongside a real reverting wrap / a real payout.
    uint256 public reserveFunded; // cumulative USDC wrapped into the confidential reserve (1e6)
    uint256 public sigmaMaxPayoff; // Σ(principal + cap) of OUTSTANDING (unclaimed) notes (1e6)

    event Issued(uint256 indexed id, address indexed issuer, address indexed holder, uint64 principal, uint64 cap, uint64 windowStart, uint64 windowEnd, uint256 wrapped);
    event Settled(uint256 indexed id, uint64 refEnd, uint8 mode);
    event Claimed(uint256 indexed id, address indexed holder);

    error WindowOpen(uint64 windowEnd, uint64 nowTs);
    error BadWindow(uint64 windowStart, uint64 windowEnd);
    error NotOwner();

    constructor(address cUSDT_, address oracle_) {
        require(uint256(MAX_LEVERAGE) * uint256(MAX_DELTA) < (uint256(1) << 63), "overflow-cfg");
        require(cUSDT_ != address(0) && oracle_ != address(0), "addr=0");
        owner = msg.sender;
        cUSDT = IERC7984Wrapper(cUSDT_);
        oracle = IOracleAdapter(oracle_);
        address u = IERC7984Wrapper(cUSDT_).underlying();
        require(u != address(0), "no-underlying");
        usdc = IERC20(u);
        require(IERC7984Wrapper(cUSDT_).rate() == 1, "rate!=1");
    }

    /// @notice Issue a note. Reserve funded to maxPayoff (= principal + cap) by pulling issuer USDC
    /// and WRAPPING it — both revert on insufficiency, so an underfunded issue mints no note and moves
    /// no public accumulator. Issuer must usdc.approve(thisNote, need) first.
    function issue(
        address holder,
        uint64 principal,
        uint64 cap,
        uint64 windowStart,
        uint64 windowEnd,
        externalEuint64 encStrike,
        externalEuint64 encLeverage,
        bytes calldata proof
    ) external returns (uint256 id) {
        require(holder != address(0), "holder=0");
        require(principal > 0, "principal=0");
        if (windowEnd <= windowStart) revert BadWindow(windowStart, windowEnd);

        uint256 need = uint256(principal) + uint256(cap);
        require(need < (uint256(1) << 63), "payoff-bound");

        require(usdc.transferFrom(msg.sender, address(this), need), "usdc-transferFrom-failed");
        usdc.approve(address(cUSDT), need);
        cUSDT.wrap(address(this), need);

        reserveFunded += need;
        sigmaMaxPayoff += need;
        require(reserveFunded >= sigmaMaxPayoff, "insolvent");

        euint64 strike = FHE.fromExternal(encStrike, proof);
        euint64 leverage = FHE.fromExternal(encLeverage, proof);
        leverage = FHE.min(leverage, MAX_LEVERAGE);

        FHE.allowThis(strike);
        FHE.allowThis(leverage);

        id = noteCount++;
        Note storage n = notes[id];
        n.issuer = msg.sender;
        n.holder = holder;
        n.principal = principal;
        n.cap = cap;
        n.strike = strike;
        n.leverage = leverage;
        n.windowStart = windowStart;
        n.windowEnd = windowEnd;

        emit Issued(id, msg.sender, holder, principal, cap, windowStart, windowEnd, need);
    }

    /// @notice Finalize refEnd from the oracle. Permissionless once the window has closed; settle-once.
    /// Uses settlementPrice: window TWAP if ≥2 observations, else a fresh staleness-guarded spot read —
    /// so an unsampled window cannot permanently lock the note (H1). Reverts only if the window is
    /// unsampled AND no source is fresh (the genuine oracle-down case).
    function settle(uint256 id) external {
        Note storage n = notes[id];
        require(n.issuer != address(0), "no-note");
        require(!n.settled, "settled");
        if (block.timestamp < n.windowEnd) revert WindowOpen(n.windowEnd, uint64(block.timestamp));
        (uint64 refEnd, uint8 mode) = oracle.settlementPrice(n.windowStart, n.windowEnd);
        n.refEnd = refEnd;
        n.settleMode = mode;
        n.settled = true;
        emit Settled(id, refEnd, mode);
    }

    /// @notice payoff = principal + min(cap, leverage * max(0, refEnd - strike)). Branchless.
    function claim(uint256 id) external {
        Note storage n = notes[id];
        require(n.settled, "not-settled");
        require(!n.claimed, "claimed");
        require(msg.sender == n.holder, "not-holder");
        n.claimed = true;

        ebool itm = FHE.gt(n.refEnd, n.strike);
        euint64 rawDelta = FHE.sub(FHE.asEuint64(n.refEnd), n.strike);
        euint64 delta = FHE.select(itm, rawDelta, FHE.asEuint64(0));
        delta = FHE.min(delta, MAX_DELTA);

        euint64 levDelta = FHE.mul(n.leverage, delta);
        euint64 capped = FHE.min(levDelta, n.cap);
        euint64 payoff = FHE.add(capped, n.principal);

        n.payoff = payoff;
        FHE.allowThis(payoff);
        FHE.allow(payoff, n.holder);

        sigmaMaxPayoff -= (uint256(n.principal) + uint256(n.cap));

        FHE.allowTransient(payoff, address(cUSDT));
        cUSDT.confidentialTransfer(n.holder, payoff);

        emit Claimed(id, n.holder);
    }

    /// @notice Owner-gated audit hook (H2): grant `auditor` ACL on the reserve balance handle so it can
    /// be userDecrypted to verify solvency. Restricted because the reserve decrypts to cumulative payout
    /// info; a persistent FHE.allow cannot be revoked, so only the owner may extend it.
    function allowReserveTo(address auditor) external returns (euint64 reserveHandle) {
        if (msg.sender != owner) revert NotOwner();
        reserveHandle = cUSDT.confidentialBalanceOf(address(this));
        FHE.allow(reserveHandle, auditor);
    }

    function reserveBalanceHandle() external view returns (euint64) {
        return cUSDT.confidentialBalanceOf(address(this));
    }

    function getPayoff(uint256 id) external view returns (euint64) { return notes[id].payoff; }
    function getStrike(uint256 id) external view returns (euint64) { return notes[id].strike; }
    function getRefEnd(uint256 id) external view returns (uint64) { return notes[id].refEnd; }
}
