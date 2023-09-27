// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;

import "../../interfaces/IHTLC.sol";

abstract contract HTLCBase is IHTLC {
    bool public finished;
    address public recipient;
    address public from;
    uint256 public startTime;
    uint256 public lockTime;
    uint256 public amount;
    bytes32 public secret;
    bytes32 public hash;

    event Withdrawn();
    event Refunded();

    error AlreadyFinished();
    error TooLate();
    error TooEarly();
    error InvalidSecret();
    error InsufficientFunds();
    error InvalidRecipient();
    error InvalidAmount();
    error InvalidLockTime();

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
        startTime = block.timestamp;
        lockTime = _lockTime;
        finished = false;
        from = msg.sender;
    }

    function withdraw(bytes32 _secret) public {
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

    function canRefund(uint256 timestamp) external view returns (bool) {
        return !finished && !_beforeLockTime(timestamp) && _enoughFunds();
    }

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
        return timestamp < startTime + lockTime;
    }

    function _transfer() virtual internal{}
    function _refund() virtual internal{}
    function _enoughFunds() virtual internal view returns (bool) {}
}