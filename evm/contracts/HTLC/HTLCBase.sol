// SPDX-License-Identifier: AGPL-3
pragma solidity 0.8.21;

import "../../interfaces/IHTLC.sol";

/// @title HashTime-Lock Contract
/// @author Archethic Foundation
abstract contract HTLCBase is IHTLC {

    /// @inheritdoc IHTLC
    bool public finished;

    /// @inheritdoc IHTLC
    address public recipient;

    /// @inheritdoc IHTLC
    address public from;

    /// @inheritdoc IHTLC
    uint256 public lockTime;

    /// @inheritdoc IHTLC
    uint256 public amount;

    /// @inheritdoc IHTLC
    bytes32 public secret;

    /// @inheritdoc IHTLC
    bytes32 public hash;

    /// @notice Notifies when the HTLC's secret is reveal and the funds have been sent to the receiver
    event Withdrawn();

    /// @notice Notifiew when the HTLC funds have been reclaimed to refund them
    event Refunded();

    /// @notice Throws when the HTLC is already finished: withdrawn or refunded
    error AlreadyFinished();

    /// @notice Throws when the HTLC's locktime is reached (see withdraw function)
    error TooLate();

    /// @notice Throws when the HTLC's locktime is not yet reached (see refund function)
    error TooEarly();

    /// @notice Throws when the secret doesn't match the hash
    error InvalidSecret();

    /// @notice Throws when the HTLC doesn't have enough funds
    error InsufficientFunds();

    /// @notice Throws when the HTLC's recipient is invalid
    error InvalidRecipient();

    /// @notice Throws when the HTLC's amount is invalid
    error InvalidAmount();

    /// @notice Throws when the HTLC's locktime is invalid
    error InvalidLockTime();


    /// @notice Create a HTLC contract
    /// @dev InvalidRecipient, InvalidAmount and InvalidLockTime can be thrown if the values are incorrect
    /// @dev the sender becomes the `from` of the HTLC
    constructor(address _recipient, uint256 _amount, bytes32 _hash, uint _lockTime) {
        if (_recipient == address(0)) {
            revert InvalidRecipient();
        }

        if (_amount == 0) {
            revert InvalidAmount();
        }

        if (_lockTime == 0) {
            revert InvalidLockTime();
        }

        recipient = _recipient;
        amount = _amount;
        hash = _hash;
        lockTime = _lockTime;
        finished = false;
        from = msg.sender;
    }

    /// @inheritdoc IHTLC
    /// @dev It raises if the HTLC has already been withdrawn or refunded
    /// @dev It raises if the hash of the given secret doesn't match the HTLC's hash
    /// @dev It raises if the HTLC doesn't have enough funds
    /// @dev It raises if it's called after the locktime
    function withdraw(bytes32 _secret) virtual external {
        _withdraw(_secret);
    }

    function _withdraw(bytes32 _secret) internal {
        if (finished) {
            revert AlreadyFinished();
        }
        if (sha256(abi.encodePacked(_secret)) != hash) {
            revert InvalidSecret();
        }
        if (!_enoughFunds()) {
            revert InsufficientFunds();
        }
        if (!_beforeLockTime(block.timestamp)) {
            revert TooLate();
        }
        secret = _secret;
        _transfer();
        finished = true;
        emit Withdrawn();
    }

    /// @inheritdoc IHTLC
    /// @dev The contract can be refunded if the HTLC is not yet finished, the given time is after the locktime and the contracts have funds
    function canRefund(uint256 timestamp) external view returns (bool) {
        return !finished && !_beforeLockTime(timestamp) && _enoughFunds();
    }

    /// @inheritdoc IHTLC
    /// @dev It raises if the HTLC has already been withdrawn or refunded
    /// @dev It raises if the HTLC doesn't have enough funds
    /// @dev It raises if it's called before the locktime
    function refund() external {
        if (finished) {
            revert AlreadyFinished();
        }
        if (!_enoughFunds()) {
            revert InsufficientFunds();
        }
        if (_beforeLockTime(block.timestamp)) {
            revert TooEarly();
        }
        _refund();
        finished = true;
        emit Refunded();
    }

    function _beforeLockTime(uint256 timestamp) internal view returns (bool) {
        return timestamp < lockTime;
    }

    function _transfer() virtual internal{}
    function _refund() virtual internal{}
    function _enoughFunds() virtual internal view returns (bool) {}

    function enoughFunds() external view returns (bool) {
        return _enoughFunds();
    }
}