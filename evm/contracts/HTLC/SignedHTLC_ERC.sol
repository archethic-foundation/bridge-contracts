// SPDX-License-Identifier: AGPL-3

pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./HTLC_ERC.sol";

using SafeMath for uint256;

contract SignedHTLC_ERC is HTLC_ERC {
    address public poolSigner;

    error InvalidSignature();

    constructor(address _recipient, IERC20 _token, uint256 _amount, bytes32 _hash, uint _lockTime, address _poolSigner) HTLC_ERC(_recipient, _token,  _amount, _hash, _lockTime) {
        poolSigner = _poolSigner;
    }

    function signedWithdraw(bytes32 _secret, bytes32 _r, bytes32 _s, uint8 _v) external {
        bytes32 sigHash = ECDSA.toEthSignedMessageHash(_secret);
        address signer = ECDSA.recover(sigHash, _v, _r, _s);

        if (signer != poolSigner) {
            revert InvalidSignature();
        }

        delete sigHash;
        delete signer;

        withdraw(_secret);
    }

    function signatureHash() public view returns (bytes32) {
        return keccak256(abi.encodePacked(amount, hash, recipient, token));
    }
 }