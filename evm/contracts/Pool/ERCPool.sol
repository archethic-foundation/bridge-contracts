// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;

import "./PoolBase.sol";
import "../HTLC/ChargeableHTLC_ERC.sol";
import "../HTLC/SignedHTLC_ERC.sol";
import "../../interfaces/IHTLC.sol";

using SafeMath for uint256;

/// @custom:oz-upgrades-unsafe-allow external-library-linking
contract ERCPool is PoolBase {

    IERC20 public token;

    event TokenChanged(address indexed _token);
    error CannotSendEthers();

    function initialize(address _reserveAddress, address _safetyAddress, uint256 _safetyFee, address _archPoolSigner, uint256 _poolCap, IERC20 _token) initializer public {
        __Pool_Init(_reserveAddress, _safetyAddress, _safetyFee, _archPoolSigner, _poolCap);
        token = _token;
	}

    function setToken(IERC20 _token) onlyOwner external {
        token = _token;
        emit TokenChanged(address(_token));
    }

    function _createSignedHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) override internal returns (IHTLC) {
        IERC20 _token = token;
        if (_token.balanceOf(address(this)) < _amount) {
            revert InsufficientFunds();
        } 

        SignedHTLC_ERC htlcContract = new SignedHTLC_ERC(msg.sender, _token, _amount, _hash, _lockTime, archethicPoolSigner);
        _token.transfer(address(htlcContract), _amount);
        return htlcContract;
    }

    function mintHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) override payable external {
        if (msg.value != 0) {
            revert CannotSendEthers();
        }
        _mintHTLC(_hash, _amount, _lockTime);
    }

    function _createChargeableHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) override internal returns (IHTLC) {
        uint256 _fee = swapFee(_amount);
        ChargeableHTLC_ERC htlcContract = new ChargeableHTLC_ERC(token, _amount.sub(_fee), _hash, _lockTime, payable(reserveAddress), payable(safetyModuleAddress), _fee);
        return htlcContract;
    }
}
