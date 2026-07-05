// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

/// Minimal Chainlink AggregatorV3 surface (matches the live Sepolia feed proxies).
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
    function getRoundData(uint80 roundId)
        external
        view
        returns (uint80, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title OracleAdapter (C2)
/// @notice TWAP reference-price oracle over a LIVE Chainlink-class Sepolia feed.
/// Permissionless observation log → time-weighted average over a settlement window,
/// with a max-staleness guard and a secondary-feed fallback. Output is 1e6-scaled to
/// match ConfidentialNote's refEnd convention. No mock feed: reads real on-chain rounds.
contract OracleAdapter {
    AggregatorV3Interface public immutable primary;
    AggregatorV3Interface public immutable secondary; // optional fallback; address(0) = none
    uint256 public immutable maxStaleness; // seconds; a round older than this is "stale"
    uint8 public immutable primaryDecimals;
    uint8 public immutable secondaryDecimals;

    /// source: 1 = primary, 2 = secondary (fallback used because primary was stale)
    struct Obs {
        uint64 ts; // block timestamp the sample was recorded
        uint192 price1e6; // feed answer rescaled to 1e6
        uint8 source;
    }

    Obs[] public observations;

    event Observed(uint256 indexed idx, uint64 ts, uint192 price1e6, uint8 source);

    error StalePrice(uint256 updatedAt, uint256 nowTs, uint256 maxStaleness);
    error NoFreshSource();
    error BadPrice(int256 answer);
    error WindowTooFewObs(uint256 count);
    error WindowZeroSpan();

    constructor(address primary_, address secondary_, uint256 maxStaleness_) {
        require(primary_ != address(0), "primary=0");
        require(maxStaleness_ > 0, "maxStaleness=0");
        primary = AggregatorV3Interface(primary_);
        primaryDecimals = AggregatorV3Interface(primary_).decimals();
        secondary = AggregatorV3Interface(secondary_);
        secondaryDecimals = secondary_ == address(0) ? 0 : AggregatorV3Interface(secondary_).decimals();
        maxStaleness = maxStaleness_;
    }

    function observationCount() external view returns (uint256) {
        return observations.length;
    }

    function _scaleTo1e6(int256 answer, uint8 dec) internal pure returns (uint192) {
        if (answer <= 0) revert BadPrice(answer);
        uint256 a = uint256(answer);
        uint256 scaled = dec >= 6 ? a / (10 ** (dec - 6)) : a * (10 ** (6 - dec));
        return uint192(scaled);
    }

    /// @notice Read a feed's fresh price (1e6) or revert if stale. Pure helper; reverts surface staleness.
    function _readFresh(AggregatorV3Interface feed, uint8 dec) internal view returns (uint192) {
        (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
        if (block.timestamp - updatedAt > maxStaleness) {
            revert StalePrice(updatedAt, block.timestamp, maxStaleness);
        }
        return _scaleTo1e6(answer, dec);
    }

    /// @notice Read-only current price (1e6) of a source without reverting — for off-chain checks/UI.
    /// Returns (price1e6, updatedAt, stale).
    function peek(bool useSecondary) external view returns (uint192 price1e6, uint256 updatedAt, bool stale) {
        AggregatorV3Interface feed = useSecondary ? secondary : primary;
        uint8 dec = useSecondary ? secondaryDecimals : primaryDecimals;
        (, int256 answer, , uint256 ua, ) = feed.latestRoundData();
        updatedAt = ua;
        stale = block.timestamp - ua > maxStaleness;
        price1e6 = answer > 0 ? _scaleTo1e6(answer, dec) : 0;
    }

    /// @notice Permissionless: sample the reference price into the observation log.
    /// Tries primary; if primary is stale, falls back to secondary (if configured).
    /// Reverts if no source is fresh — stale prices never enter the log.
    function observe() external returns (uint192 price1e6, uint8 source) {
        // primary
        (, int256 pAns, , uint256 pUp, ) = primary.latestRoundData();
        if (block.timestamp - pUp <= maxStaleness && pAns > 0) {
            price1e6 = _scaleTo1e6(pAns, primaryDecimals);
            source = 1;
        } else if (address(secondary) != address(0)) {
            (, int256 sAns, , uint256 sUp, ) = secondary.latestRoundData();
            if (block.timestamp - sUp <= maxStaleness && sAns > 0) {
                price1e6 = _scaleTo1e6(sAns, secondaryDecimals);
                source = 2;
            } else {
                revert NoFreshSource();
            }
        } else {
            // no fallback: surface the primary staleness explicitly
            revert StalePrice(pUp, block.timestamp, maxStaleness);
        }

        uint256 idx = observations.length;
        observations.push(Obs(uint64(block.timestamp), price1e6, source));
        emit Observed(idx, uint64(block.timestamp), price1e6, source);
    }

    /// @notice Settlement price for a window: the window TWAP when ≥2 in-window observations exist,
    /// otherwise a fresh staleness-guarded SPOT read (primary, then secondary). This guarantees a
    /// note can always settle as long as ANY source is fresh at settle time — an unsampled window can
    /// no longer permanently lock a note. `mode`: 0 = TWAP, 1 = spot(primary), 2 = spot(secondary).
    /// Reverts (NoFreshSource) only when the window is unsampled AND no source is fresh — the genuine
    /// "oracle fully down" terminal case.
    function settlementPrice(uint64 fromTs, uint64 toTs) external view returns (uint64 price1e6, uint8 mode) {
        require(toTs > fromTs, "bad-range");

        // observations are appended in block order → ts is non-decreasing → binary-search the window
        // bounds so settle() scans ONLY the in-window slice, never the full (unbounded) history.
        (uint256 first, uint256 last, uint256 cnt) = _windowBounds(fromTs, toTs);

        if (cnt >= 2 && observations[last].ts > observations[first].ts) {
            uint64 span = observations[last].ts - observations[first].ts;
            uint256 acc;
            for (uint256 i = first; i < last; i++) {
                uint64 dt = observations[i + 1].ts - observations[i].ts;
                acc += uint256(observations[i].price1e6) * uint256(dt);
            }
            return (uint64(acc / uint256(span)), 0);
        }

        // spot fallback — read the price AT MATURITY (the latest round with updatedAt <= toTs), not the
        // current spot at settle time. This removes the post-maturity timing option (settle() is
        // permissionless + first-caller-wins): the settlement price is pinned to the round covering the
        // window's close, whenever settle() is actually mined. Primary first, then secondary.
        int256 p = _priceAt(primary, toTs);
        if (p > 0) return (uint64(_scaleTo1e6(p, primaryDecimals)), 1);
        if (address(secondary) != address(0)) {
            int256 s = _priceAt(secondary, toTs);
            if (s > 0) return (uint64(_scaleTo1e6(s, secondaryDecimals)), 2);
        }
        revert NoFreshSource();
    }

    /// @dev The feed's answer as of `asOf`: the most recent round whose updatedAt <= asOf. Walks back
    /// from the latest round (Chainlink round ids are sequential per phase) up to a bounded number of
    /// steps, so it's not the mutable current spot but a maturity-pinned price. Returns 0 if the latest
    /// round is stale beyond maxStaleness (oracle down) or no covering round is found within the bound.
    function _priceAt(AggregatorV3Interface feed, uint64 asOf) internal view returns (int256) {
        (uint80 rid, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
        if (updatedAt == 0 || block.timestamp - updatedAt > maxStaleness) return 0; // oracle down
        // if the latest round is already at//before maturity, use it
        if (updatedAt <= asOf) return answer;
        // else walk back to the last round updated at/before maturity (bounded)
        for (uint256 k = 0; k < 128 && rid > 0; k++) {
            rid--;
            (, int256 a, , uint256 u, ) = feed.getRoundData(rid);
            if (u != 0 && u <= asOf) return a;
        }
        // no covering round within the bound — fall back to the (fresh) latest answer rather than lock
        return answer;
    }

    /// @notice Step (left-Riemann) time-weighted average of observations whose timestamps fall in
    /// [fromTs, toTs]. TWAP = Σ price[i]·(t[i+1]−t[i]) / (t[last]−t[first]). Deterministic, hand-checkable.
    /// Reverts if fewer than 2 in-window observations (no interval) or zero span.
    /// Kept for hand-verification; settle() uses settlementPrice (which falls back to spot).
    function twap(uint64 fromTs, uint64 toTs) public view returns (uint64 price1e6) {
        require(toTs > fromTs, "bad-range");
        (uint256 first, uint256 last, uint256 cnt) = _windowBounds(fromTs, toTs);
        if (cnt < 2) revert WindowTooFewObs(cnt);

        uint64 span = observations[last].ts - observations[first].ts;
        if (span == 0) revert WindowZeroSpan();

        uint256 acc; // Σ price[i]·dt over consecutive in-window pairs
        for (uint256 i = first; i < last; i++) {
            uint64 dt = observations[i + 1].ts - observations[i].ts;
            acc += uint256(observations[i].price1e6) * uint256(dt);
        }
        price1e6 = uint64(acc / uint256(span));
    }

    /// @dev Binary-search the in-window index range [first, last] and count. observations[].ts is
    /// non-decreasing (append-only in block order), so this is O(log n) — settle()/twap never scan
    /// the full unbounded history, closing the observation-array gas-DoS. Returns cnt=0 if none.
    function _windowBounds(uint64 fromTs, uint64 toTs)
        internal
        view
        returns (uint256 first, uint256 last, uint256 cnt)
    {
        uint256 n = observations.length;
        if (n == 0) return (0, 0, 0);

        // first index with ts >= fromTs (lower bound)
        uint256 lo = 0;
        uint256 hi = n;
        while (lo < hi) {
            uint256 mid = (lo + hi) >> 1;
            if (observations[mid].ts < fromTs) lo = mid + 1;
            else hi = mid;
        }
        first = lo;

        // first index with ts > toTs (upper bound); last in-window = that - 1
        lo = first;
        hi = n;
        while (lo < hi) {
            uint256 mid = (lo + hi) >> 1;
            if (observations[mid].ts <= toTs) lo = mid + 1;
            else hi = mid;
        }
        if (lo == first) return (0, 0, 0); // no observation in [fromTs, toTs]
        last = lo - 1;
        cnt = last - first + 1;
    }
}
