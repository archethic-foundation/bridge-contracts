// SPDX-License-Identifier: GNU AGPLv3
pragma solidity 0.8.21;

import "./HTLCBase.sol";

/// @title HTLC contract customized for ETH transfers
/// @author Archethic Foundation
contract HTLC_ETH is HTLCBase {

    /// @notice Notify when ethers have been received
    event FundsReceived(uint _amount);

    /// @notice Throws when the contract is not yet provisioned with funds
    error ContractNotProvisioned();

    /// @dev Create HTLC contract with capability to delegate funds assertion after the constructor
    constructor(address payable _recipient, uint256 _amount, bytes32 _hash, uint _lockTime, bool _delegateFundsAssertion) payable HTLCBase(_recipient, _amount, _hash, _lockTime) {
        if (!_delegateFundsAssertion) {
            _assertReceivedFunds(_amount);
        }
    }

    /// @dev Throws if the funds are not received
    /// @dev Emit FundsReceived event once done
    function _assertReceivedFunds(uint256 _amount) virtual internal {
        if(msg.value != _amount) {
           revert ContractNotProvisioned();
        }
        emit FundsReceived(msg.value);
    }

    /// @dev Send ethers to the HTLC's recipient
    function _transferAsWithdraw() override virtual internal {
        (bool sent,) = recipient.call{value: amount}("");
        require(sent, "ETH transfer failed - withdraw");
    }

    /// @dev Send back ethers to the HTLC's creator
    function _transferAsRefund() override virtual internal {
        (bool sent,) = from.call{value: amount}("");
        require(sent, "ETH transfer failed - refund");
    }

    function _enoughFunds() override virtual internal view returns (bool) {
        return address(this).balance >= amount;
    }
 }
