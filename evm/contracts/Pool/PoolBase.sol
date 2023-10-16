// SPDX-License-Identifier: AGPL-3
pragma solidity 0.8.21;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

import "../../interfaces/IPool.sol";
import "../../interfaces/IHTLC.sol";

/// @title Pool to manage assets for Archethic's bridge on EVM's side
/// @author Archethic Foundation
abstract contract PoolBase is IPool, Initializable, Ownable2StepUpgradeable {

    /// @inheritdoc IPool
    bool public locked;

    /// @inheritdoc IPool
    address public reserveAddress;

    /// @inheritdoc IPool
    address public safetyModuleAddress;

    /// @inheritdoc IPool
    address public archethicPoolSigner;

    /// @inheritdoc IPool
    uint256 public poolCap;

    /// @inheritdoc IPool
    uint256 public safetyModuleFeeRate;

    /// @notice Returns the lock time period for the deployed contracts
    uint256 public lockTimePeriod;

    mapping(bytes32 => IHTLC) private _refProvisionedSwaps;
    mapping(bytes32 => IHTLC) private _refMintedSwaps;

    address[] private _provisionedSwaps;
    address[] private _mintedSwaps;

    /// @notice Notifies a change about the reserve destination wallet
    event ReserveAddressChanged(address indexed _reservedAddress);

    /// @notice Notifies a change about the safety module destination wallet
    event SafetyModuleAddressChanged(address indexed _safetyModuleAddress);

    /// @notice Notifies a change about the safety module fee
    event SafetyModuleFeeRateChanged(uint256 indexed _safetyModuleFeeRate);

    /// @notice Notifies a change about the Archethic's pool address to sign provisioning of contracts
    event ArchethicPoolSignerChanged(address indexed _signer);

    /// @notice Notifies a change about the pool assets capacity
    event PoolCapChanged(uint256 indexed _poolCap);

    /// @notice Notifies the pool locking
    event Lock();

    /// @notice Notifies the pool unlocking
    event Unlock();

    /// @notice Nofifies a new contract provisioned
    event ContractProvisioned(IHTLC indexed _htlc, uint256 indexed _amount);

    /// @notice Nofifies a new contract minted
    event ContractMinted(IHTLC indexed _htlc, uint256 indexed _amount);

    /// @notice Notifies a change about the lock time period
    event LockTimePeriodChanged(uint256 indexed _lockTimePeriod);

    /// @notice Throws when the reserve address is invalid
    error InvalidReserveAddress();

    /// @notice Throws when the safety module address is invalid
    error InvalidSafetyModuleAddress();

    /// @notice Throws when the Archethic's pool signer is invalid
    error InvalidArchethicPoolSigner();

    /// @notice Throws when the reserve address is invalid
    error AlreadyProvisioned();

    /// @notice Throws when a secret have already been used in a swap
    error AlreadyMinted();

    /// @notice Throws when the signature from Archethic's pool signer is invalid
    error InvalidSignature();

    /// @notice Throws when the pool doesn't have enough funds
    error InsufficientFunds();

    /// @notice Throws when pool is locked
    error Locked();

    /// @notice Throws when the reserve address is invalid
    error InvalidLockTimePeriod();

    /// @notice Throws when the lock time is invalid
    error InvalidLockTime();

    /// @notice Throws when the HTLC's hash is invalid
    error InvalidHash();

    /// @notice Throws when the HTLC's amount is invalid
    error InvalidAmount();

    /// @notice Initizalize the pool with all the given properties
    /// @param _reserveAddress The destination address for the reserve wallet
    /// @param _safetyAddress The destination address for the safety module wallet
    /// @param _safetyFeeRate The fee rate to fund the safety module
    /// @param _archPoolSigner The address of the Archethic's pool signer
    /// @param _poolCap The maximum capacity of the pool's asset
    /// @param _lockTimePeriod The locktime period of the new HTLC contracts
    /// @dev The safety module fee rate is multiplied by 100 to match 2 decimals percentage
    function __Pool_Init(address _reserveAddress, address _safetyAddress, uint256 _safetyFeeRate, address _archPoolSigner, uint256 _poolCap, uint256 _lockTimePeriod) onlyInitializing virtual internal {
        __Ownable2Step_init();

        if(_reserveAddress == address(0)) {
            revert InvalidReserveAddress();
        }

        if(_safetyAddress == address(0)) {
            revert InvalidSafetyModuleAddress();
        }
        if(_archPoolSigner == address(0)) {
            revert InvalidArchethicPoolSigner();
        }

        if (_lockTimePeriod == 0) {
            revert InvalidLockTimePeriod();
        }

        reserveAddress = _reserveAddress;
        safetyModuleAddress = _safetyAddress;
        safetyModuleFeeRate = _safetyFeeRate * 100;
        archethicPoolSigner = _archPoolSigner;
        poolCap = _poolCap;
        locked = false;
        lockTimePeriod = _lockTimePeriod;
    }

    /// @dev Check whether the pool is locked. 
    /// @dev This is used instead of modifier to be more gas efficient
    function checkUnlocked() internal view {
        require(!locked, "Locked");
    }

    /// @inheritdoc IPool
    /// @dev ReserveAddressChanged event is emitted once done
    function setReserveAddress(address _reserveAddress) virtual external {
        _checkOwner();
        if(_reserveAddress == address(0)) {
            revert InvalidReserveAddress();
        }
        reserveAddress = _reserveAddress;
        emit ReserveAddressChanged(_reserveAddress);
    }

    /// @inheritdoc IPool
    /// @dev SafetyModuleAddressChanged event is emitted once done
    function setSafetyModuleAddress(address _safetyAddress) virtual external {
        _checkOwner();
        if(_safetyAddress == address(0)) {
            revert InvalidSafetyModuleAddress();
        }
        safetyModuleAddress = _safetyAddress;
        emit SafetyModuleAddressChanged(_safetyAddress);
    }

    /// @inheritdoc IPool
    /// @dev SafetyModuleFeeRateChanged event is emitted once done
    /// @dev The fee rate is multiplied by 100 to match 2 decimals percentage
    function setSafetyModuleFeeRate(uint256 _safetyFeeRate) virtual external {
        _checkOwner();
        safetyModuleFeeRate = _safetyFeeRate * 100;
        emit SafetyModuleFeeRateChanged(_safetyFeeRate);
    }

    /// @inheritdoc IPool
    /// @dev ArchethicPoolSignerChanged event is emitted once done
    function setArchethicPoolSigner(address _archPoolSigner) virtual external {
        _checkOwner();
        if(_archPoolSigner == address(0)) {
            revert InvalidArchethicPoolSigner();
        }
        archethicPoolSigner = _archPoolSigner;
        emit ArchethicPoolSignerChanged(_archPoolSigner);
    }

    /// @inheritdoc IPool
    /// @dev PoolCapChanged event is emitted once done
    function setPoolCap(uint256 _poolCap) virtual external {
        _checkOwner();
        poolCap = _poolCap;
        emit PoolCapChanged(_poolCap);
    }

    /// @inheritdoc IPool
    /// @dev Unlock event is emitted once done
    function unlock() virtual external {
        _checkOwner();
        locked = false;
        emit Unlock();
    }

    /// @inheritdoc IPool
    /// @dev Lock event is emitted once done
    function lock() virtual external {
        _checkOwner();
        locked = true;
        emit Lock();
    }

    /// @inheritdoc IPool
    /// @dev LockTimePeriodChanged event is emitted once done
    function setLockTimePeriod(uint _lockTimePeriod) virtual external {
        _checkOwner();
        if (_lockTimePeriod == 0) {
            revert InvalidLockTimePeriod();
        }

        lockTimePeriod = _lockTimePeriod;
        emit LockTimePeriodChanged(_lockTimePeriod);
    }
    
    /// @notice Returns the swap fee to be send to the safety module
    /// @dev The fee is multiplied by 100000 to convert back from 2 decimals using wei in the amount
    /// @dev The fee is truncated after 8 decimals to match Archethic decimals policy
    /// @param _amount Asset's amount to swap
    /// @param _decimals Number of decimals for the token
    function swapFee(uint256 _amount, uint8 _decimals) internal view returns (uint256) {
        uint256 _safetyModuleFeeRate = safetyModuleFeeRate;
        
        if (_safetyModuleFeeRate == 0) {
            return 0;
        }
        uint256 _fee = (_amount * _safetyModuleFeeRate) / 100000;

        if (_decimals > 8) {
            uint256 _decimalsToTrunc = 10 ** (_decimals - 8);
            return (_fee / _decimalsToTrunc) * _decimalsToTrunc;
        } else {
            return _fee;
        }
    }

    /// @inheritdoc IPool
    function provisionedSwaps() external view returns (address[] memory) {
        return _provisionedSwaps;
    }

    /// @inheritdoc IPool
    function provisionedSwap(bytes32 _hash) external view returns (IHTLC) {
        return _refProvisionedSwaps[_hash];
    }

    /// @inheritdoc IPool
    /// @dev Can only be done once the pool is unlocked
    /// @dev The locktime must greater than the current block timestamp and before the next day
    /// @dev The secret's hash cannot be reused
    /// @dev ContractProvisioned event is emitted once done
    /// @dev An error is thrown whether the locktime is invalid, the swap already provisioned or the signature from Archethic's pool is invalid
    function provisionHTLC(bytes32 _hash, uint256 _amount, uint _lockTime, bytes32 _r, bytes32 _s, uint8 _v) external {
        checkUnlocked();

        if (_hash == bytes32(0)) {
            revert InvalidHash();
        }

        if (_amount == 0) {
            revert InvalidAmount();
        }

        // Locktime cannot:
        // - be zero
        // - be more than 1 day or less than the lockTime
        // - be before the block's timestamp
        if (_lockTime == 0 || _lockTime < block.timestamp || (_lockTime - block.timestamp) > 86400) {
            revert InvalidLockTime();
        }

        if(address(_refProvisionedSwaps[_hash]) != address(0)) {
            revert AlreadyProvisioned();
        }

        bytes32 messagePayloadHash = keccak256(abi.encodePacked(_hash, bytes32(block.chainid)));
        bytes32 signedMessageHash = ECDSA.toEthSignedMessageHash(messagePayloadHash);
        address signer = ECDSA.recover(signedMessageHash, _v, _r, _s);
        if (signer != archethicPoolSigner) {
            revert InvalidSignature();
        }

        delete signer;
        delete messagePayloadHash;
        delete signedMessageHash;

        IHTLC htlcContract = _createSignedHTLC(_hash, _amount, _lockTime);
        _refProvisionedSwaps[_hash] = htlcContract;

        _provisionedSwaps.push(address(htlcContract));

        emit ContractProvisioned(htlcContract, _amount);
    } 

    /// @inheritdoc IPool
    function mintedSwaps() external view returns (address[] memory) {
        return _mintedSwaps;
    }

    /// @inheritdoc IPool
    function mintedSwap(bytes32 _hash) external view returns (IHTLC) {
        return _refMintedSwaps[_hash];
    }

    /// @inheritdoc IPool
    /// @dev ContractMinted event is emitted once done
    /// @dev An error is thrown whether the secret's hash is already taken by a previous swap
    /// @dev The HTLC locktime is determined by the pool's locktime period
    function mintHTLC(bytes32 _hash, uint256 _amount) payable virtual external {
        if (_hash == bytes32(0)) {
            revert InvalidHash();
        }

        if (_amount == 0) {
            revert InvalidAmount();
        }

        _mintHTLC(_hash, _amount, _chargeableHTLCLockTime());
    }

    function _mintHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) internal {
        if(address(_refMintedSwaps[_hash]) != address(0)) {
            revert AlreadyMinted();
        }
        IHTLC htlcContract = _createChargeableHTLC(_hash, _amount, _lockTime);
        _refMintedSwaps[_hash] = htlcContract;
        _mintedSwaps.push(address(htlcContract));
        emit ContractMinted(htlcContract, _amount);
    }

    function _createSignedHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) virtual internal returns (IHTLC) {}
    function _createChargeableHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) virtual internal returns (IHTLC) {}

    function _chargeableHTLCLockTime() internal view returns (uint256) {
        // We need to round to the minute as Archethic's smart contract self trigger feature restrict timestamp to rounded minute
        uint256 minuteRoundedBlockTimestamp = block.timestamp - (block.timestamp % (60));
        return minuteRoundedBlockTimestamp + lockTimePeriod;
    }
}
