// SPDX-License-Identifier: AGPL-3
pragma solidity 0.8.21;

import "./HTLC_ETH.sol";

/// @title HTLC contract with chargeable fee towards pool's safety module
/// @author Archethic Foundation
contract ChargeableHTLC_ETH is HTLC_ETH {

    /// @notice Return the fee's amount
    uint256 public immutable fee;

    /// @notice Return the amount to refill the owner of the contract (i.e Pool)
    uint256 public immutable refillAmount;

    /// @notice Return the amount to withdraw to the main's recipient
    uint256 public immutable withdrawAmount;

    /// @notice Return the satefy module destination wallet
    address public immutable safetyModuleAddress;

    /// @dev Create HTLC instance but delegates funds control after the HTLC constructor
    /// @dev This way we can check funds with decorrelation between amount/fee and the sent ethers. 
    constructor(
        uint256 _amount,
        bytes32 _hash,
        uint _lockTime,
        address payable _reserveAddress,
        address payable _safetyModuleAddress,
        uint256 _fee,
        uint256 _refillAmount
    ) payable HTLC_ETH(_reserveAddress, _amount + _refillAmount, _hash, _lockTime, true) {
        fee = _fee;
        safetyModuleAddress = _safetyModuleAddress;
        from = tx.origin;
        refillAmount = _refillAmount;
        withdrawAmount = _amount;
        // We check if the received ethers adds the deducted amount from the fee
        _assertReceivedFunds(_amount + _fee + _refillAmount);
    }

     /// @dev Check whether the HTLC have enough tokens to cover fee + amount
    function _enoughFunds() internal view override returns (bool) {
        return address(this).balance == (amount + fee);
    }

    /// @dev Send ethers to the HTLC's recipient and safety module fee
    function _transfer() internal override {
        bool sent = false;
        uint _fee = fee;
        uint _refillAmount = refillAmount;

        if (_fee > 0) {
            (sent, ) = safetyModuleAddress.call{value: _fee}("");
            require(sent, "ETH transfer failed - withdraw/safety");
        }
        (sent, ) = recipient.call{value: withdrawAmount}("");
        require(sent, "ETH transfer failed - withdraw/recipient");

        if (_refillAmount > 0) {
            (sent, ) = from.call{value: _refillAmount}("");
            require(sent, "ETH transfer failed - withdraw/refill");
        } 
    }

    /// @dev Send back ethers (amount + fee) to the HTLC's creator
    function _refund() internal override {
        (bool sent, ) = from.call{value: amount + fee}("");
        require(sent, "ETH transfer failed - refund");
    }
}
