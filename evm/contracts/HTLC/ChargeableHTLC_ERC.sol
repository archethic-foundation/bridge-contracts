// SPDX-License-Identifier: GNU AGPLv3
pragma solidity 0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./HTLC_ERC.sol";
import "../../interfaces/IPool.sol";

/// @title HTLC contract where funds are delivered by the user
/// @author Archethic Foundation
contract ChargeableHTLC_ERC is HTLC_ERC {
    /// @notice Returns the Archethic's pool signer address
    address public immutable poolSigner;

    /// @notice Throws when the Archethic's pool signature is invalid
    error InvalidSignature();

    /// @notice Throws when the Archethic's pool signer is invalid
    error InvalidPoolSigner();

    constructor(
        IERC20 _token,
        uint256 _amount,
        bytes32 _hash,
        uint _lockTime,
        address _recipient,
        address _poolSigner
    ) HTLC_ERC(_recipient, _token, _amount, _hash, _lockTime) {
        if (_poolSigner == address(0)) {
            revert InvalidPoolSigner();
        }
        from = tx.origin;
        poolSigner = _poolSigner;
    }

    /// @notice Reveal secret and withdraw the locked funds by transferring them to the recipient address upon the Archethic's pool signature
    function withdraw(
        bytes32 _secret,
        bytes32 _r,
        bytes32 _s,
        uint8 _v
    ) external override {
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
}
