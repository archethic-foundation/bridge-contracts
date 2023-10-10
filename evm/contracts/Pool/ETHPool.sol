// SPDX-License-Identifier: AGPL-3
pragma solidity 0.8.21;

import "./PoolBase.sol";
import "../HTLC/ChargeableHTLC_ETH.sol";
import "../HTLC/SignedHTLC_ETH.sol";
import "../../interfaces/IHTLC.sol";

/// @custom:oz-upgrades-unsafe-allow external-library-linking
/// @title Pool to manage ETH asset for Archethic's bridge on EVM's side
/// @author Archethic Foundation
contract ETHPool is PoolBase {

    /// @notice Nofifies Ether receiving
    event FundsReceived(uint256 indexed _amount);

    /// @notice Throws if the pool's capacity is reached
    error ProvisionLimitReached();

    /// @notice Throws if the contract is not provisioned
    error ContractNotProvisioned();

	function initialize(address _reserveAddress, address _safetyAddress, uint256 _safetyFee, address _archPoolSigner, uint256 _poolCap, uint256 _lockTimePeriod) initializer external {
        __Pool_Init(_reserveAddress, _safetyAddress, _safetyFee, _archPoolSigner, _poolCap, _lockTimePeriod);
	}

    /// @notice Accept the reception of ethers
    /// @dev FundsReceived is emitted once done
    /// @dev Checks whether the pool's capacity isn't reached and throws ProvisionLimitReached otherwise
    receive() payable external {
        if(address(this).balance > poolCap) {
            revert ProvisionLimitReached();
        }
        emit FundsReceived(msg.value);
    }

    /// Create HTLC token unlocked by the secret and signature of the Archethic's pool
    /// Tokens are transfered from the pool's balance
    /// An error is throw is the pool doesn't have enough funds
    function _createSignedHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) internal override returns (IHTLC) {
        if (address(this).balance < _amount) {
            revert InsufficientFunds();
        } 

        SignedHTLC_ETH htlcContract = (new SignedHTLC_ETH){value: _amount}(payable(msg.sender), _amount, _hash, _lockTime, archethicPoolSigner);
        return htlcContract;
    }

    /// Create HTLC token with fee towards the pool's safety module
    /// The recipients will be the pool's reserve address and safety module's address
    /// This can accept ethers for the same amount of the swap
    /// The amount of the HTLC is then reduced by the pool's safety module rate
    function _createChargeableHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) override internal returns (IHTLC) {
        if (msg.value != _amount) {
            revert ContractNotProvisioned();
        }
        uint256 _fee = swapFee(_amount);

        ChargeableHTLC_ETH htlcContract = (new ChargeableHTLC_ETH){value: _amount}(_amount - _fee, _hash, _lockTime, payable(reserveAddress), payable(safetyModuleAddress), _fee);
        return htlcContract;
    }
}
