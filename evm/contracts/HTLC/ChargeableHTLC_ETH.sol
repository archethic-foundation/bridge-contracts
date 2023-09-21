// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./HTLC_ETH.sol";

using SafeMath for uint256;

contract ChargeableHTLC_ETH is HTLC_ETH {
    uint256 public fee;
    address public safetyModuleAddress;

    constructor(
        uint256 _amount,
        bytes32 _hash,
        uint _lockTime,
        address payable _reserveAddress,
        address payable _safetyModuleAddress,
        uint256 _fee
    ) payable HTLC_ETH(_reserveAddress, _amount, _hash, _lockTime, true) {
        fee = _fee;
        safetyModuleAddress = _safetyModuleAddress;
        _assertReceivedFunds(_amount.add(_fee));
    }

    function _enoughFunds() internal view override returns (bool) {
        return address(this).balance == amount.add(fee);
    }

    function _transfer() internal override {
        (bool sent, ) = safetyModuleAddress.call{value: fee}("");
        require(sent);
        (sent, ) = recipient.call{value: amount}("");
        require(sent);
    }

    function _refund() internal override {
        (bool sent, ) = from.call{value: amount.add(fee)}("");
        require(sent);
    }
}
