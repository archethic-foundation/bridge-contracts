// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;

import "./HTLCBase.sol";

contract HTLC_ETH is HTLCBase {
    event FundsReceived(uint _amount);

    error ProvisionLimitReached();

    constructor(address payable _recipient, uint256 _amount, bytes32 _hash, uint _lockTime) HTLCBase(_recipient, _amount, _hash, _lockTime) {
    }

    receive() payable external {
        _checkAmount();
        if (finished) {
            revert AlreadyFinished();
        }
        if (!_beforeLockTime()) {
            revert TooLate();
        }
        emit FundsReceived(msg.value);
    }

    function _checkAmount() virtual internal {
        if(address(this).balance > amount) {
            revert ProvisionLimitReached();
        }
    }

    function _transfer() override virtual internal {
        (bool sent,) = recipient.call{value: amount}("");
        require(sent);
    }

    function _refund() override virtual internal {
        (bool sent,) = from.call{value: amount}("");
        require(sent);
    }

    function _enoughFunds() override virtual internal view returns (bool) {
        return address(this).balance == amount;
    }
 }