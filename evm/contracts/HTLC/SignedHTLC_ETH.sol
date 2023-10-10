// SPDX-License-Identifier: AGPL-3

pragma solidity 0.8.21;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./HTLC_ETH.sol";

using SafeMath for uint256;

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