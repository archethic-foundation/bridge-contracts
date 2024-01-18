// SPDX-License-Identifier: AGPL-3
pragma solidity 0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./HTLC_ERC.sol";
import "../../interfaces/IPool.sol";

/// @title HTLC contract with chargeable fee towards pool's safety module
/// @author Archethic Foundation
contract ChargeableHTLC_ERC is HTLC_ERC {

    /// @notice Return the fee's amount
    uint256 public immutable fee;

    /// @notice Return the amount to refill the pool
    uint256 public refillAmount;

    /// @notice Return the amount to withdraw to the main's recipient
    uint256 public withdrawAmount;

    /// @notice Return the satefy module destination wallet
    address public immutable safetyModuleAddress;

    /// @notice Return the refill address to send the refillAmount
    address public immutable refillAddress;

    constructor(
        IERC20 _token,
        uint256 _amount,
        bytes32 _hash,
        uint _lockTime,
        address _reserveAddress,
        address _safetyModuleAddress,
        uint256 _fee,
        address _refillAddress
    ) HTLC_ERC(_reserveAddress, _token, _amount, _hash, _lockTime) {
        fee = _fee;
        safetyModuleAddress = _safetyModuleAddress;
        from = tx.origin;
        refillAddress = _refillAddress;
    }

    /// @dev Check whether the HTLC have enough tokens to cover fee + amount
    function _enoughFunds() internal view override returns (bool) {
        return token.balanceOf(address(this)) == (amount + fee);
    }

    /// @dev Send ERC20 to the HTLC's recipient and safety module fee
    function _transfer() internal override {
        IERC20 _token = token;

        uint _fee = fee;
        address _refillAddress = refillAddress;

        IPool pool = IPool(_refillAddress);
        uint256 _poolCap = pool.poolCap();
        uint256 _poolBalance = _token.balanceOf(_refillAddress);

        uint256 _withdrawAmount = amount;
        uint256 _refillAmount;

        if (_poolBalance < _poolCap) {
            uint256 _poolCapacity = _poolCap - _poolBalance;
            if(_poolCapacity > 0 && _withdrawAmount > _poolCapacity) {
                _withdrawAmount = _withdrawAmount - _poolCapacity;
                _refillAmount = _poolCapacity;
            }
        }

        if (_fee > 0) {
            SafeERC20.safeTransfer(_token, safetyModuleAddress, _fee);
        }

        if (_withdrawAmount > 0) {
            withdrawAmount = _withdrawAmount;
            SafeERC20.safeTransfer(_token, recipient, _withdrawAmount);
        }

        if (_refillAmount > 0) {
            refillAmount = _refillAmount;
            SafeERC20.safeTransfer(_token, _refillAddress, _refillAmount);
        } 
    }

    /// @dev Send back ERC20 (amount + fee) to the HTLC's creator
    function _refund() internal override {
        SafeERC20.safeTransfer(token, from, (amount + fee));
    }
}
