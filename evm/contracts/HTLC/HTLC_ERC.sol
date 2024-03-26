// SPDX-License-Identifier: GNU AGPLv3
pragma solidity 0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./HTLCBase.sol";

/// @title HTLC contract customized for ERC20 transfers
/// @author Archethic Foundation
contract HTLC_ERC is HTLCBase {

    /// @notice HTLC's ERC20 token
    IERC20 public token;

    constructor(address _recipient, IERC20 _token, uint256 _amount, bytes32 _hash, uint _lockTime) HTLCBase(_recipient, _amount, _hash, _lockTime) {
        token = _token;
    }

    /// @dev Send ERC20 to the HTLC's recipient
    function _transferAsWithdraw() internal override virtual {
        SafeERC20.safeTransfer(token, recipient, amount);
    }

    /// @dev Send back ERC20 to the HTLC's creator
    function _transferAsRefund() internal override virtual {
        SafeERC20.safeTransfer(token, from, amount);
    }

    function _enoughFunds() internal override virtual view returns (bool) {
        return token.balanceOf(address(this)) >= amount;
    }
 }
