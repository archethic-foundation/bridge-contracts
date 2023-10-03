// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;

import "./IHTLC.sol";

interface IPool {
    function provisionHTLC(bytes32 _hash, uint256 _amount, uint _lockTime, bytes32 _r, bytes32 _s, uint8 _v) external;
    function mintHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) payable external;
    function setReserveAddress(address _reserveAddress) external;
    function setSafetyModuleAddress(address _safetyAddress) external;
    function setSafetyModuleFeeRate(uint256 _safetyFeeRate) external;
    function setArchethicPoolSigner(address _archPoolSigner) external;
    function setPoolCap(uint256 _poolCap) external;
    function unlock() external;
    function lock() external;

    // Public state variable
    function reserveAddress() external returns(address);
    function safetyModuleAddress() external returns(address);
    function archethicPoolSigner() external returns(address);
    function safetyModuleFeeRate() external returns(uint256);
    function poolCap() external returns(uint256);
    function locked() external returns(bool);
    function provisionedSwaps() external returns (address[] memory);
    function mintedSwaps() external returns (address[] memory);

    function provisionedSwap(bytes32 _hash) external returns (IHTLC);
    function mintedSwap(bytes32 _hash) external returns (IHTLC);
}