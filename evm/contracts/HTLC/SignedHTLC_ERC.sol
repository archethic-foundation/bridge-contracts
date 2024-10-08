// SPDX-License-Identifier: GNU AGPLv3

pragma solidity 0.8.21;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./HTLC_ERC.sol";

/// @title HTLC contract with signature verification before withdraw for ERC20 swap
/// @author Archethic Foundation
contract SignedHTLC_ERC is HTLC_ERC {
    /// @notice Returns the Archethic's pool signer address
    address public immutable poolSigner;

    /// @notice Throws when the Archethic's pool signature is invalid
    error InvalidSignature();

    /// @notice Throws when the Archethic's pool signer is invalid
    error InvalidPoolSigner();

    constructor(
        address _recipient,
        IERC20 _token,
        bool _mintableToken,
        uint256 _amount,
        bytes32 _hash,
        uint _lockTime,
        address _poolSigner
    )
        HTLC_ERC(
            _recipient,
            _token,
            false,
            _mintableToken,
            _amount,
            _hash,
            _lockTime
        )
    {
        if (_poolSigner == address(0)) {
            revert InvalidPoolSigner();
        }
        poolSigner = _poolSigner;
    }

    /// @notice Reveal secret and withdraw the locked funds by transferring them to the recipient address upon the Archethic's pool signature
    function withdraw(
        bytes32 _secret,
        bytes32 _r,
        bytes32 _s,
        uint8 _v
    ) external override {
        bytes32 sigHash = ECDSA.toEthSignedMessageHash(_secret);
        address signer = ECDSA.recover(sigHash, _v, _r, _s);

        delete sigHash;

        if (signer != poolSigner) {
            revert InvalidSignature();
        }

        delete signer;

        _withdraw(_secret);
    }

    function refund(
        bytes32 _secret,
        bytes32 _r,
        bytes32 _s,
        uint8 _v
    ) external {
        bytes32 messagePayload = keccak256(bytes.concat(_secret, "refund"));
        bytes32 signedMessageHash = ECDSA.toEthSignedMessageHash(
            messagePayload
        );
        address signer = ECDSA.recover(signedMessageHash, _v, _r, _s);

        delete messagePayload;
        delete signedMessageHash;

        if (signer != poolSigner) {
            revert InvalidSignature();
        }

        delete signer;

        if (sha256(abi.encodePacked(_secret)) != hash) {
            revert InvalidSecret();
        }

        _refund();
    }

    /// @dev Prevent to use the direct refund's function without the signature
    function refund() external pure override {
        revert InvalidSignature();
    }
}
