// SPDX-License-Identifier: AGPL-3

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

    constructor(address _recipient, IERC20 _token, uint256 _amount, bytes32 _hash, uint _lockTime, address _poolSigner) HTLC_ERC(_recipient, _token,  _amount, _hash, _lockTime) {
        poolSigner = _poolSigner;
    }

    /// @notice Reveal secret and withdraw the locked funds by transferring them to the recipient address upon the Archethic's pool signature
    /// @dev Signature verification is done before to do the usual withdraw flow of the HTLC
    function withdraw(bytes32 _secret, bytes32 _r, bytes32 _s, uint8 _v) external {
        bytes32 sigHash = ECDSA.toEthSignedMessageHash(_secret);
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

    function refund(bytes32 _secret, bytes32 _r, bytes32 _s, uint8 _v) external {
        bytes32 sigHash = ECDSA.toEthSignedMessageHash(_secret);
        address signer = ECDSA.recover(sigHash, _v, _r, _s);

        if (signer != poolSigner) {
            revert InvalidSignature();
        }

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