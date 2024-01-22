// SPDX-License-Identifier: AGPL-3

pragma solidity 0.8.21;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./HTLC_ETH.sol";

/// @title HTLC contract with signature verification before withdraw for ether swap
/// @author Archethic Foundation
contract SignedHTLC_ETH is HTLC_ETH {
    /// @notice Returns the Archethic's pool signer address
    address public immutable poolSigner;

    /// @notice Throws when the Archethic's pool signature is invalid
    error InvalidSignature();

    constructor(address payable _recipient, uint256 _amount, bytes32 _hash, uint _lockTime, address _poolSigner) payable HTLC_ETH(_recipient, _amount, _hash, _lockTime, false) {
        poolSigner = _poolSigner;
    }

    /// @notice Reveal secret and withdraw the locked funds by transferring them to the recipient address upon the Archethic's pool signature
    /// @dev Signature verification is done before to do the usual withdraw flow of the HTLC
    function withdraw(bytes32 _secret, bytes32 _r, bytes32 _s, uint8 _v) external {
        bytes32 sigHash = ECDSA.toEthSignedMessageHash(_secret);
        address signer = ECDSA.recover(sigHash, _v, _r, _s);

        delete sigHash;

        if (signer != poolSigner) {
            revert InvalidSignature();
        }

        delete signer;

        _withdraw(_secret);
    }

    /// @dev Prevent to use the direct withdraw's function without the signature
    function withdraw(bytes32) override pure external {
        revert InvalidSignature();
    }

    /// @notice Refund the HTLC contract upon the Archethic's pool signature
    /// @dev Signature verification is done before to do the usual refund flow of the HTLC
    function refund(bytes32 _secret, bytes32 _r, bytes32 _s, uint8 _v) external {
        bytes32 messagePayload = keccak256(abi.encodePacked(_secret, "refund"));
        bytes32 signedMessageHash = ECDSA.toEthSignedMessageHash(messagePayload);
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
    function refund() override pure external {
        revert InvalidSignature();
    }
 }
