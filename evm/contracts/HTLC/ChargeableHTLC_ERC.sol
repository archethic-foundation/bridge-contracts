// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./HTLC_ERC.sol";

using SafeMath for uint256;

contract ChargeableHTLC_ERC is HTLC_ERC {
    uint256 public fee;
    address public safetyModuleAddress;

    constructor(
        IERC20 _token,
        uint256 _amount,
        bytes32 _hash,
        uint _lockTime,
        address payable _reserveAddress,
        address payable _safetyModuleAddress,
        uint256 _fee
    ) HTLC_ERC(_reserveAddress, _token, _amount, _hash, _lockTime) {
        fee = _fee;
        safetyModuleAddress = _safetyModuleAddress;
    }

    function _enoughFunds() internal view override returns (bool) {
        return token.balanceOf(address(this)) == amount.add(fee);
    }

    function _transfer() internal override {
        IERC20 _token = token;

        _token.transfer(safetyModuleAddress, fee);
        _token.transfer(recipient, amount);
    }

    function _refund() internal override {
        token.transfer(from, amount.add(fee));
    }
}
