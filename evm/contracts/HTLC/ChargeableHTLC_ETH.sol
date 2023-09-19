// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./HTLC_ETH.sol";
import "../../interfaces/IPool.sol";

using SafeMath for uint256;

contract ChargeableHTLC_ETH is HTLC_ETH {
    IPool public pool;
    uint256 public fee;

    constructor(
        uint256 _amount,
        bytes32 _hash,
        uint _lockTime,
        IPool _pool
    ) HTLC_ETH(payable(_pool.reserveAddress()), _amount, _hash, _lockTime) {
        pool = _pool;
        uint256 _fee = _amount.mul(_pool.safetyModuleFeeRate()).div(100000);
        amount = _amount.sub(_fee);
        fee = _fee;
    }

    function _checkAmount() internal view override {
        if (address(this).balance > amount.add(fee)) {
            revert ProvisionLimitReached();
        }
    }

    function _enoughFunds() internal view override returns (bool) {
        return address(this).balance == amount.add(fee);
    }

    function _transfer() internal override {
        (bool sent, ) = pool.safetyModuleAddress().call{value: fee}("");
        require(sent);
        (sent, ) = recipient.call{value: amount}("");
        require(sent);
    }

    function _refund() internal override {
        (bool sent, ) = from.call{value: amount.add(fee)}("");
        require(sent);
    }
}
