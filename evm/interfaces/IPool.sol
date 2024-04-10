// SPDX-License-Identifier: AGPL-3
pragma solidity 0.8.21;

import "./IHTLC.sol";

interface IPool {
    /// @notice Provision an HTLC contract by checking the signature coming from the Archethic's blockchain pool
    /// @param _hash Secret's hash of the HTLC
    /// @param _amount Amount of the swap
    /// @param _lockTime Lock time given by the Archethic's pool
    /// @param _r Signature's R part
    /// @param _s Signature's S part
    /// @param _v SIgnature's recovery part
    function provisionHTLC(bytes32 _hash, uint256 _amount, uint _lockTime, bytes memory _archethicHTLCAddress, bytes32 _r, bytes32 _s, uint8 _v) external;

    /// @notice Mint an HTLC contract by specifying the reserve and safety module as recipient of the HTLC and chargeable in fee for the safety module.
    /// @param _hash Secret's hash of the HTLC
    /// @param _amount Amount of the swap
    function mintHTLC(bytes32 _hash, uint256 _amount) payable external;

    /// @notice Update the reserve destination wallet. (Restricted to the pool's owner)
    /// @param _reserveAddress Destination address of the reserve wallet
    function setReserveAddress(address _reserveAddress) external;

    /// @notice Update the safety module destination wallet. (Restricted to the pool's owner)
    /// @param _safetyAddress Destination address of the safety module wallet
    function setSafetyModuleAddress(address _safetyAddress) external;

    /// @notice Update the safety module fee rate. (Restricted to the pool's owner)
    /// @param _safetyFeeRate Satefy module fee rate
    function setSafetyModuleFeeRate(uint256 _safetyFeeRate) external;

    /// @notice Update the Archethic pool signer address. (Restricted to the pool's owner)
    /// @param _archPoolSigner Archethic's pool signer address
    function setArchethicPoolSigner(address _archPoolSigner) external;

    /// @notice Update the pool's asset capacity. (Restricted to the pool's owner)
    /// @param _poolCap Pool's asset capacity
    function setPoolCap(uint256 _poolCap) external;

    /// @notice Update the pool locktime period (Restricted to the pool's owner)
    /// @param _lockTimePeriod Lock time period expressed in seconds
    function setLockTimePeriod(uint256 _lockTimePeriod) external;

    /// @notice Unlock the pool (Restricted to the pool's owner)
    function unlock() external;

    /// @notice Lock the pool (Restricted to the pool's owner)
    function lock() external;

    /// @notice Returns the destination for the reserve's wallet (destination of the bridged assets)
    function reserveAddress() external returns(address);

    /// @notice Returns the destination for the safety module's wallet (guarantee funds filled with protocol's fee)
    function safetyModuleAddress() external returns(address);

    /// @notice Returns the address of the Archethic's pool able to sign and assert actions done on Archethic's blockchain
    function archethicPoolSigner() external returns(address);

    /// @notice Returns the fee rate to fund the safety module
    function safetyModuleFeeRate() external returns(uint256);

    /// @notice Returns the maximum amount of the capacity of the pool assets
    function poolCap() external returns(uint256);

    /// @notice Determines if the pool is locked or not
    function locked() external returns(bool);

    /// @notice Return the list of provisioned swaps
    /// @return addresses List of HTLC address
    function provisionedSwaps() external returns (address[] memory);

    /// @notice Return the list of minted swaps
    /// @return addresses List of HTLC address
    function mintedSwaps() external returns (address[] memory);

    /// @notice Return a provisioned swap by its secret's hash
    /// @return htlc Address of the HTLC's contract
    function provisionedSwap(bytes32 _hash) external returns (IHTLC);

    /// @notice Return a minted swap by its secret's hash
    /// @return htlc Address of the HTLC's contract
    function mintedSwap(bytes32 _hash) external returns (IHTLC);

    enum SwapType { CHARGEABLE_HTLC, SIGNED_HTLC }

    struct Swap {
        address evmAddress;
        bytes archethicAddress;
        SwapType swapType;
    }

    /// @notice Return the list of swaps by owner's address
    /// @return swaps List of swaps, including EVM & Archethic's htlc address & Swap's type: Chargeable (From EVM) or Signed (To Evm)
    function getSwapsByOwner(address owner) external view returns (Swap[] memory swaps);
}
