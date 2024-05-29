// SPDX-License-Identifier: GNU AGPLv3
pragma solidity 0.8.21;

interface IHTLC {

    enum HTLCStatus { PENDING, WITHDRAWN, REFUNDED }

    /// @notice Determines if the HTLC can be refunded
    /// @return bool
    function canRefund(uint256 timestamp) external view returns (bool);

    /// @notice Returns the amount of the asset to swap
    /// @return Amount
    function amount() external returns(uint256);

    /// @notice Returns the creator of the HTLC
    /// @return Address
    function from() external returns(address);

    /// @notice Returns the secret's hash of swap
    /// @return Hash
    function hash() external returns(bytes32);

    /// @notice Returns the reveled secret of the swap
    /// @return Bytes
    function secret() external returns(bytes32);

    /// @notice Returns the swap's locktime (timestamp)
    /// @return Timestamp
    function lockTime() external returns(uint256);

    /// @notice Returns the recipient address of the swap
    /// @return Address
    function recipient() external returns(address);

    /// @notice Determines the status of the swap: pending, withdrawn or refunded
    /// @return HTLCStatus
    function status() external returns(HTLCStatus);

    /// @notice Reveal secret and withdraw the locked funds by transferring them to the recipient address upon the Archethic's pool signature
    function withdraw(bytes32, bytes32, bytes32, uint8) external;

    /// @notice Refund the swap after the locktime
    function refund() external;

    /// @notice Determines if the HTLC have enough funds
    /// @return bool
    function enoughFunds() external view returns (bool);
}
