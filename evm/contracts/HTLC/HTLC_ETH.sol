// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;

import "./HTLCBase.sol";

contract HTLC_ETH is HTLCBase {
    event FundsReceived(uint _amount);
    error ContractNotProvisioned();

    constructor(address payable _recipient, uint256 _amount, bytes32 _hash, uint _lockTime, bool _delegateFundsAssertion) payable HTLCBase(_recipient, _amount, _hash, _lockTime) {
        if (!_delegateFundsAssertion) {
            _assertReceivedFunds(_amount);
        }
    }
   
    function _assertReceivedFunds(uint256 _amount) virtual internal {
        if(msg.value != _amount) {
           revert ContractNotProvisioned();
        }
        emit FundsReceived(msg.value);
    }

     function _amountToReceive() virtual internal view returns (uint256) {
        return amount;
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