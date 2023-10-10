// SPDX-License-Identifier: AGPL-3
pragma solidity 0.8.21;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./HTLC_ETH.sol";

using SafeMath for uint256;

/// @title HTLC contract with chargeable fee towards pool's safety module
/// @author Archethic Foundation
contract ChargeableHTLC_ETH is HTLC_ETH {

    /// @notice Return the fee's amount
    uint256 public fee;

    /// @notice Return the satefy module destination wallet
    address public safetyModuleAddress;

    /// @dev Create HTLC instance but delegates funds control after the HTLC constructor
    /// @dev This way we can check funds with decorrelation between amount/fee and the sent ethers. 
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
        // We check if the received ethers adds the deducted amount from the fee
        _assertReceivedFunds(_amount.add(_fee));
    }

     /// @dev Check whether the HTLC have enough tokens to cover fee + amount
    function _enoughFunds() internal view override returns (bool) {
        return address(this).balance == amount.add(fee);
    }

    /// @dev Send ethers to the HTLC's recipient and safety module fee
    function _transfer() internal override {
        (bool sent, ) = safetyModuleAddress.call{value: fee}("");
        require(sent, "ETH transfer failed - withdraw/safety");
        (sent, ) = recipient.call{value: amount}("");
        require(sent, "ETH transfer failed - withdraw/recipient");
    }

    /// @dev Send back ethers (amount + fee) to the HTLC's creator
    function _refund() internal override {
        (bool sent, ) = from.call{value: amount.add(fee)}("");
        require(sent, "ETH transfer failed - refund");
    }
}
