// SPDX-License-Identifier: GNU AGPLv3
pragma solidity 0.8.21;

import "./PoolBase.sol";
import "../HTLC/ChargeableHTLC_ETH.sol";
import "../HTLC/SignedHTLC_ETH.sol";
import "../../interfaces/IHTLC.sol";

/// @custom:oz-upgrades-unsafe-allow external-library-linking
/// @title Pool to manage ETH asset for Archethic's bridge on EVM's side
/// @author Archethic Foundation
contract ETHPool is PoolBase {

    mapping(address => Swap[]) _swapsByOwner;

    /// @notice Nofifies Ether receiving
    event FundsReceived(uint256 indexed _amount);

    /// @notice Throws if the pool's capacity is reached
    error ProvisionLimitReached();

    /// @notice Throws if the contract is not provisioned
    error ContractNotProvisioned();

	function initialize(address _archPoolSigner, uint256 _lockTimePeriod, address _multisig) initializer external {
        __Pool_Init(_archPoolSigner, _lockTimePeriod, _multisig);
	}

    /// @notice Accept the reception of ethers
    /// @dev FundsReceived is emitted once done
    receive() payable external {
        emit FundsReceived(msg.value);
    }

    /// Create HTLC token unlocked by the secret and signature of the Archethic's pool
    /// Tokens are transfered from the pool's balance
    /// An error is throw is the pool doesn't have enough funds
    function _createSignedHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) internal override returns (IHTLC) {
        if (address(this).balance < _amount) {
            revert InsufficientFunds();
        }

        checkAmountWithDecimals(_amount);

        SignedHTLC_ETH htlcContract = (new SignedHTLC_ETH){value: _amount}(payable(msg.sender), _amount, _hash, _lockTime, archethicPoolSigner);
        return htlcContract;
    }

    /// Create HTLC token where funds are delivered by the user
    /// This can accept ethers for the same amount of the swap
    function _createChargeableHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) override internal returns (IHTLC) {
        checkAmountWithDecimals(_amount);

        if (msg.value != _amount) {
            revert ContractNotProvisioned();
        }

        uint256 _recipientAmount = _amount;

        ChargeableHTLC_ETH htlcContract = (new ChargeableHTLC_ETH){value: _amount}(_recipientAmount, _hash, _lockTime, payable(address(this)), archethicPoolSigner);
        return htlcContract;
    }

    function checkAmountWithDecimals(uint256 _amount) pure private {
        // Make sure the decimals matches the Archethic's decimal policy about 1e8. (The trailing decimals must be assigned to 0)
        uint8 mod = 18 - 8;
        if(_amount % (10 ** mod) != 0) {
            revert InvalidAmount();
        }
    }

    function getSwapsByOwner(address owner) external view override returns (Swap[] memory swaps) {
        uint size = _swapsByOwner[owner].length;
        swaps = new Swap[](size);

        for (uint i = 0; i < size; i++) {
            swaps[i]= _swapsByOwner[owner][i];
        }
    }

    function setSwapByOwner(address _owner, address _htlcContract, bytes memory _archethicHTLCAddress, SwapType _swapType) override internal {
        _swapsByOwner[_owner].push(Swap(_htlcContract, _archethicHTLCAddress, _swapType));
    }
}
