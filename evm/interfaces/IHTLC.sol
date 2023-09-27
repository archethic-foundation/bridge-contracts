// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;

interface IHTLC {
    function canRefund(uint256 timestamp) external view returns (bool);

    function amount() external returns(uint256);
    function hash() external returns(bytes32);
    function secret() external returns(bytes32);
    function lockTime() external returns(uint256);
    function recipient() external returns(address);
    function finished() external returns(bool);
    function startTime() external returns(uint256);

    function withdraw(bytes32) external;
    function refund() external;
}