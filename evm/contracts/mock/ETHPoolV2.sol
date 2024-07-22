// SPDX-License-Identifier: GNU AGPLv3
pragma solidity 0.8.21;

import "./PoolBaseV2.sol";

contract ETHPoolV2 is PoolBaseV2 {
    mapping(address => Swap[]) _swapsByOwner;
}
