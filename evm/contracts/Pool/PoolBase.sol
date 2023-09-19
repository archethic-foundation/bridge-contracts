// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../../interfaces/IPool.sol";
import "../../interfaces/IHTLC.sol";


contract PoolBase is IPool, Initializable, OwnableUpgradeable {

    bool public locked;
    address public reserveAddress;
    address public safetyModuleAddress;
    address public archethicPoolSigner;
    uint256 public poolCap;
    uint256 public safetyModuleFeeRate;

    mapping(bytes32 => IHTLC) _provisionedSwaps;
    mapping(bytes32 => IHTLC) _mintedSwaps;

    event ReserveAddressChanged(address indexed _reservedAddress);
    event SafetyModuleAddressChanged(address indexed _safetyModuleAddress);
    event SafetyModuleFeeRateChanged(uint256 indexed _safetyModuleFeeRate);
    event ArchethicPoolSignerChanged(address indexed _signer);
    event PoolCapChanged(uint256 indexed _poolCap);
    event Lock();
    event Unlock();
    event ContractProvisioned(IHTLC indexed _htlc, uint256 indexed _amount);
    event ContractMinted(IHTLC indexed _htlc, uint256 indexed _amount);

    error InvalidReserveAddress();
    error InvalidSafetyModuleAddress();
    error InvalidArchethicPoolSigner();
    error AlreadyProvisioned();
    error AlreadyMinted();
    error InvalidSignature();
    error InsufficientFunds();
    error Locked();

    function __Pool_Init(address _reserveAddress, address _safetyAddress, uint256 _safetyFeeRate, address _archPoolSigner, uint256 _poolCap) onlyInitializing virtual internal {
        __Ownable_init();

        if(_reserveAddress == address(0)) {
            revert InvalidReserveAddress();
        }

        if(_safetyAddress == address(0)) {
            revert InvalidSafetyModuleAddress();
        }
        if(_archPoolSigner == address(0)) {
            revert InvalidArchethicPoolSigner();
        }

        reserveAddress = _reserveAddress;
        safetyModuleAddress = _safetyAddress;
        safetyModuleFeeRate = _safetyFeeRate;
        archethicPoolSigner = _archPoolSigner;
        poolCap = _poolCap;
        locked = true;
    }

    function checkUnlocked() internal view {
        require(!locked, "Locked");
    }

    function setReserveAddress(address _reserveAddress) virtual external {
        _checkOwner();
        if(_reserveAddress == address(0)) {
            revert InvalidReserveAddress();
        }
        reserveAddress = _reserveAddress;
        emit ReserveAddressChanged(_reserveAddress);
    }

    function setSafetyModuleAddress(address _safetyAddress) virtual external {
        _checkOwner();
        if(_safetyAddress == address(0)) {
            revert InvalidSafetyModuleAddress();
        }
        safetyModuleAddress = _safetyAddress;
        emit SafetyModuleAddressChanged(_safetyAddress);
    }

    function setSafetyModuleFeeRate(uint256 _safetyFeeRate) virtual external {
        _checkOwner();
        safetyModuleFeeRate = _safetyFeeRate;
        emit SafetyModuleFeeRateChanged(_safetyFeeRate);
    }

    function setArchethicPoolSigner(address _archPoolSigner) virtual external {
        _checkOwner();
        if(_archPoolSigner == address(0)) {
            revert InvalidArchethicPoolSigner();
        }
        archethicPoolSigner = _archPoolSigner;
        emit ArchethicPoolSignerChanged(_archPoolSigner);
    }

    function setPoolCap(uint256 _poolCap) virtual external {
        _checkOwner();
        poolCap = _poolCap;
        emit PoolCapChanged(_poolCap);
    }

    function unlock() virtual external {
        _checkOwner();
        locked = false;
        emit Unlock();
    }

    function lock() virtual external {
        _checkOwner();
        locked = true;
        emit Unlock();
    }

    function provisionedSwaps(bytes32 _hash) external view returns (IHTLC) {
        return _provisionedSwaps[_hash];
    }

    function provisionHTLC(bytes32 _hash, uint256 _amount, uint _lockTime, bytes32 _r, bytes32 _s, uint8 _v) virtual external {
        checkUnlocked();

        if(address(_provisionedSwaps[_hash]) != address(0)) {
            revert AlreadyProvisioned();
        }

        bytes32 signatureHash = ECDSA.toEthSignedMessageHash(_hash);
        address signer = ECDSA.recover(signatureHash, _v, _r, _s);

        if (signer != archethicPoolSigner) {
            revert InvalidSignature();
        }

        delete signer;
        delete signatureHash;

        IHTLC htlcContract = _provisionHTLC(_hash, _amount, _lockTime);
        _provisionedSwaps[_hash] = htlcContract;
        emit ContractProvisioned(htlcContract, _amount);
    } 

    function mintedSwaps(bytes32 _hash) external view returns (IHTLC) {
        return _mintedSwaps[_hash];
    }

    function mintHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) virtual external {
        if(address(_mintedSwaps[_hash]) != address(0)) {
            revert AlreadyMinted();
        }
        IHTLC htlcContract = _mintHTLC(_hash, _amount, _lockTime);
        _mintedSwaps[_hash] = htlcContract;
        emit ContractMinted(htlcContract, _amount);
    }

    function _provisionHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) virtual internal returns (IHTLC) {}
    function _mintHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) virtual internal returns (IHTLC) {}
}
