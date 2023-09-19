// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;

import "../Pool/PoolBase.sol";

contract PoolBaseV2 is PoolBase {
    
    function setSafetyModuleFeeRate(uint256 _safetyFeeRate) onlyOwner override external {
        safetyModuleFeeRate = _safetyFeeRate * 2;
        emit SafetyModuleFeeRateChanged(_safetyFeeRate * 2);
    }
}
