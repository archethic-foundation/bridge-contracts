// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;

import "./PoolBase.sol";
import "./deployment/ETHPool_HTLCDeployer.sol";
import "../../interfaces/IHTLC.sol";

/// @custom:oz-upgrades-unsafe-allow external-library-linking
contract ETHPool is PoolBase {

    event FundsReceived(uint256 indexed _amount);
    error ProvisionLimitReached();

	function initialize(address _reserveAddress, address _safetyAddress, uint256 _safetyFee, address _archPoolSigner, uint256 _poolCap) initializer external {
        __Pool_Init(_reserveAddress, _safetyAddress, _safetyFee, _archPoolSigner, _poolCap);
	}

    receive() payable external {
        if(address(this).balance > poolCap) {
            revert ProvisionLimitReached();
        }
        emit FundsReceived(msg.value);
    }

    function _provisionHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) internal override returns (IHTLC) {
        if (address(this).balance < _amount) {
            revert InsufficientFunds();
        } 

        return ETHPool_HTLCDeployer.provisionHTLC(_hash, _amount, _lockTime, this);
    }

    function _mintHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) override internal returns (IHTLC) {
        return ETHPool_HTLCDeployer.mintHTLC(_hash, _amount, _lockTime, this);
    }
}
