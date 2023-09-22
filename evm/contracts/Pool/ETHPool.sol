// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;

import "./PoolBase.sol";
import "../HTLC/ChargeableHTLC_ETH.sol";
import "../HTLC/SignedHTLC_ETH.sol";
import "../../interfaces/IHTLC.sol";

using SafeMath for uint256;

/// @custom:oz-upgrades-unsafe-allow external-library-linking
contract ETHPool is PoolBase {

    event FundsReceived(uint256 indexed _amount);
    error ProvisionLimitReached();
    error ContractNotProvisioned();

	function initialize(address _reserveAddress, address _safetyAddress, uint256 _safetyFee, address _archPoolSigner, uint256 _poolCap) initializer external {
        __Pool_Init(_reserveAddress, _safetyAddress, _safetyFee, _archPoolSigner, _poolCap);
	}

    receive() payable external {
        if(address(this).balance > poolCap) {
            revert ProvisionLimitReached();
        }
        emit FundsReceived(msg.value);
    }

    function _createSignedHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) internal override returns (IHTLC) {
        if (address(this).balance < _amount) {
            revert InsufficientFunds();
        } 

        SignedHTLC_ETH htlcContract = (new SignedHTLC_ETH){value: _amount}(payable(msg.sender), _amount, _hash, _lockTime, archethicPoolSigner);
        return htlcContract;
    }

    function _createChargeableHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) override internal returns (IHTLC) {
        if (msg.value != _amount) {
            revert ContractNotProvisioned();
        }
        uint256 _fee = swapFee(_amount);

        ChargeableHTLC_ETH htlcContract = (new ChargeableHTLC_ETH){value: _amount}(_amount.sub(_fee), _hash, _lockTime, payable(reserveAddress), payable(safetyModuleAddress), _fee);
        return htlcContract;
    }
}
