// SPDX-License-Identifier: GNU AGPLv3
pragma solidity 0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./HTLCBase.sol";
import "../../interfaces/IERC20Mintable.sol";

/// @title HTLC contract customized for ERC20 transfers
/// @author Archethic Foundation
contract HTLC_ERC is HTLCBase {
    /// @notice HTLC's ERC20 token
    IERC20 public token;

    /// @notice True of the HTLC should burn token on withdraw
    bool public burnOnWithdraw;

    /// @notice True of the HTLC should burn token on refund
    bool public burnOnRefund;

    /// @notice Throws when the token address is invalid
    error InvalidToken();

    constructor(
        address _recipient,
        IERC20 _token,
        bool _burnOnWithdraw,
        bool _burnOnRefund,
        uint256 _amount,
        bytes32 _hash,
        uint _lockTime
    ) HTLCBase(_recipient, _amount, _hash, _lockTime) {
        if (address(_token) == address(0)) {
            revert InvalidToken();
        }
        token = _token;
        burnOnWithdraw = _burnOnWithdraw;
        burnOnRefund = _burnOnRefund;
    }

    /// @dev Send ERC20 to the HTLC's recipient
    function _transferAsWithdraw() internal virtual override {
        if (burnOnWithdraw) {
            IERC20Mintable _token = IERC20Mintable(address(token));
            _token.burn(amount);
        } else {
            SafeERC20.safeTransfer(token, recipient, amount);
        }
    }

    /// @dev Send back ERC20 to the HTLC's creator
    function _transferAsRefund() internal virtual override {
        if (burnOnRefund) {
            IERC20Mintable _token = IERC20Mintable(address(token));
            _token.burn(amount);
        } else {
            SafeERC20.safeTransfer(token, from, amount);
        }
    }

    function _enoughFunds() internal view virtual override returns (bool) {
        return token.balanceOf(address(this)) >= amount;
    }
}
