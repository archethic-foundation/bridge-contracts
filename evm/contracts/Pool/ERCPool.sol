// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;


import "./PoolBase.sol";
import "./deployment/ERCPool_HTLCDeployer.sol";
import "../../interfaces/IHTLC.sol";

/// @custom:oz-upgrades-unsafe-allow external-library-linking
contract ERCPool is PoolBase {

    IERC20 public token;

    event TokenChanged(address indexed _token);

    function initialize(address _reserveAddress, address _safetyAddress, uint256 _safetyFee, address _archPoolSigner, uint256 _poolCap, IERC20 _token) initializer public {
        __Pool_Init(_reserveAddress, _safetyAddress, _safetyFee, _archPoolSigner, _poolCap);
        token = _token;
	}

    function setToken(IERC20 _token) onlyOwner external {
        token = _token;
        emit TokenChanged(address(_token));
    }

    function _provisionHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) override internal returns (IHTLC) {
        IERC20 _token = token;
        if (_token.balanceOf(address(this)) < _amount) {
            revert InsufficientFunds();
        } 

        return ERCPool_HTLCDeployer.provisionHTLC(_hash, _amount, _lockTime, _token, this);
    }

    function _mintHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) override internal returns (IHTLC) {
        return ERCPool_HTLCDeployer.mintHTLC(_hash, _amount, _lockTime, token, this);
    }
}
