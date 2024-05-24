// SPDX-License-Identifier: GNU AGPLv3
pragma solidity 0.8.21;

import "../Pool/PoolBase.sol";

contract PoolBaseV2 is PoolBase {
    function setLockTimePeriod(uint _lockTimePeriod) override external {
        _checkOwner();
        if (_lockTimePeriod == 0) {
            revert InvalidLockTimePeriod();
        }

        lockTimePeriod = _lockTimePeriod * 3600;
        emit LockTimePeriodChanged(lockTimePeriod);
    }
}
