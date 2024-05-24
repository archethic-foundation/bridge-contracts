// SPDX-License-Identifier: GNU AGPLv3
pragma solidity 0.8.21;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./HTLC_ETH.sol";
import "../../interfaces/IPool.sol";

/// @title HTLC contract where funds are delivered by the user
/// @author Archethic Foundation
contract ChargeableHTLC_ETH is HTLC_ETH {
    /// @notice Returns the Archethic's pool signer address
    address public immutable poolSigner;

    /// @notice Throws when the Archethic's pool signature is invalid
    error InvalidSignature();

    /// @dev Create HTLC instance but delegates funds control after the HTLC constructor
    /// @dev This way we can check funds with decorrelation between amount/fee and the sent ethers.
    constructor(
        uint256 _amount,
        bytes32 _hash,
        uint _lockTime,
        address payable _recipient,
        address _poolSigner
    ) payable HTLC_ETH(_recipient, _amount, _hash, _lockTime, true) {
        from = tx.origin;
        poolSigner = _poolSigner;

        _assertReceivedFunds(_amount);
    }

    function withdraw(bytes32 _secret, bytes32 _r, bytes32 _s, uint8 _v) external {
        if (!_beforeLockTime(block.timestamp)) {
            revert TooLate();
        }
        bytes32 sigHash = ECDSA.toEthSignedMessageHash(hash);
        address signer = ECDSA.recover(sigHash, _v, _r, _s);

        if (signer != poolSigner) {
            revert InvalidSignature();
        }

        delete sigHash;
        delete signer;

        _withdraw(_secret);
    }

    /// @dev Prevent to use the direct withdraw's function without the signature
    function withdraw(bytes32) override pure external {
        revert InvalidSignature();
    }
}
