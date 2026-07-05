// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

/// @notice Day 0 validation scaffolding only — a faucet-minted ERC-7984 used to
/// exercise the cTokenMock mint (D0.2b) and the TokenOps confidential disperse
/// (D0.3). NOT product code; production consumes the registry's wrappers.
contract MockConfidentialToken is ERC7984, ZamaEthereumConfig {
    constructor() ERC7984("Vellum Mock cUSD", "cUSDM", "") {}

    /// Open faucet: trivially-encrypt a plaintext amount and mint it confidentially.
    function mint(address to, uint64 amount) external {
        euint64 amt = FHE.asEuint64(amount);
        FHE.allowThis(amt);
        _mint(to, amt);
    }
}
