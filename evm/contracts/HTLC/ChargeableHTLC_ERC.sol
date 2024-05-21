// SPDX-License-Identifier: GNU AGPLv3
pragma solidity 0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./HTLC_ERC.sol";
import "../../interfaces/IPool.sol";

/// @title HTLC contract where funds are delivered by the user and allocated to the reserve or the pool depending of the pool cap and pool's balance
/// @author Archethic Foundation
contract ChargeableHTLC_ERC is HTLC_ERC {

    /// @notice Return the amount to refill the pool
    uint256 public refillAmount;

    /// @notice Return the amount to withdraw to the main's recipient
    uint256 public withdrawAmount;

    /// @notice Return the refill address to send the refillAmount
    address public immutable refillAddress;

     /// @notice Returns the Archethic's pool signer address
    address public immutable poolSigner;

    /// @notice Throws when the Archethic's pool signature is invalid
    error InvalidSignature();

    constructor(
        IERC20 _token,
        uint256 _amount,
        bytes32 _hash,
        uint _lockTime,
        address _reserveAddress,
        address _refillAddress,
        address _poolSigner
    ) HTLC_ERC(_reserveAddress, _token, _amount, _hash, _lockTime) {
        from = tx.origin;
        refillAddress = _refillAddress;
        poolSigner = _poolSigner;
    }

    /// @dev Send ERC20 to the HTLC's recipient
    function _transferAsWithdraw() internal override {
        IERC20 _token = token;

        address _refillAddress = refillAddress;

        IPool pool = IPool(_refillAddress);
        uint256 _poolCap = pool.poolCap();
        uint256 _poolBalance = _token.balanceOf(_refillAddress);

        uint256 _withdrawAmount = amount;
        uint256 _refillAmount;

        if (_poolBalance < _poolCap) {
            uint256 _poolCapacity = _poolCap - _poolBalance;
            if(_withdrawAmount > _poolCapacity) {
                _withdrawAmount = _withdrawAmount - _poolCapacity;
                _refillAmount = _poolCapacity;
            } else {
                _refillAmount = _withdrawAmount;
                _withdrawAmount = 0;
            }
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

    function withdraw(bytes32 _secret, bytes32 _r, bytes32 _s, uint8 _v) external {
        if (!_beforeLockTime(block.timestamp)) {
            revert TooLate();
        }
        bytes32 sigHash = ECDSA.toEthSignedMessageHash(hash);
        address signer = ECDSA.recover(sigHash, _v, _r, _s);

        if (signer != poolSigner) {
            revert InvalidSignature();
        }

        delete sigHash;
        delete signer;

        _withdraw(_secret);
    }

    /// @dev Prevent to use the direct withdraw's function without the signature
    function withdraw(bytes32) override pure external {
        revert InvalidSignature();
    }
}
