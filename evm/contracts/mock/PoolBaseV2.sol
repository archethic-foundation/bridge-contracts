// SPDX-License-Identifier: GNU AGPLv3
pragma solidity 0.8.21;

import "../Pool/PoolBase.sol";

contract PoolBaseV2 is PoolBase {
    function setPoolCap(uint256 _poolCap) onlyOwner override external {
        poolCap = _poolCap * 2;
        emit PoolCapChanged(poolCap);
    }
}
