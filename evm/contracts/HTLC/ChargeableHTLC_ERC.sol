// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./HTLC_ERC.sol";
import "../../interfaces/IPool.sol";

using SafeMath for uint256;

contract ChargeableHTLC_ERC is HTLC_ERC {
    IPool public pool;
    uint256 public fee;

    constructor(
        IERC20 _token,
        uint256 _amount,
        bytes32 _hash,
        uint _lockTime,
        IPool _pool
    ) HTLC_ERC(_pool.reserveAddress(), _token, _amount, _hash, _lockTime) {
        pool = _pool;
        uint256 _fee = _amount.mul(_pool.safetyModuleFeeRate()).div(100000);
        amount = _amount.sub(_fee);

        fee = _fee;
    }

    function _enoughFunds() internal view override returns (bool) {
        return token.balanceOf(address(this)) == amount.add(fee);
    }

    function _transfer() internal override {
        IERC20 _token = token;

        _token.transfer(pool.safetyModuleAddress(), fee);
        _token.transfer(recipient, amount);
    }

    function _refund() internal override {
        token.transfer(from, amount.add(fee));
    }
}
