// SPDX-License-Identifier: AGPL-3
pragma solidity 0.8.21;

import "./PoolBase.sol";
import "../HTLC/ChargeableHTLC_ERC.sol";
import "../HTLC/SignedHTLC_ERC.sol";
import "../../interfaces/IHTLC.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @custom:oz-upgrades-unsafe-allow external-library-linking
/// @title Pool to manage ERC assets for Archethic's bridge on EVM's side
/// @author Archethic Foundation
contract ERCPool is PoolBase {

    /// @notice Pool's asset ERC20
    ERC20 public token;

    /// @notice Notifies a change about the pool's ERC20 token
    event TokenChanged(address indexed _token);

    /// @notice Throws this pool cannot received ethers
    error CannotSendEthers();

    function initialize(address _reserveAddress, address _safetyAddress, uint256 _safetyFee, address _archPoolSigner, uint256 _poolCap, uint256 _lockTimePeriod, ERC20 _token) initializer external {
        __Pool_Init(_reserveAddress, _safetyAddress, _safetyFee, _archPoolSigner, _poolCap, _lockTimePeriod);
        token = _token;
	}

    /// @notice Update the pool's asset ERC20 (Restricted to the pool's owner)
    /// @dev TokenChanged event is emitted once done
    function setToken(ERC20 _token) onlyOwner external {
        token = _token;
        emit TokenChanged(address(_token));
    }

    /// Create HTLC token unlocked by the secret and signature of the Archethic's pool
    /// Tokens are transfered from the pool's balance
    /// An error is throw is the pool doesn't have enough funds
    function _createSignedHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) override internal returns (IHTLC) {
        ERC20 _token = token;
        if (_token.balanceOf(address(this)) < _amount) {
            revert InsufficientFunds();
        } 

        checkAmountWithDecimals(_amount);

        SignedHTLC_ERC htlcContract = new SignedHTLC_ERC(msg.sender, _token, _amount, _hash, _lockTime, archethicPoolSigner);
        SafeERC20.safeTransfer(_token, address(htlcContract), _amount);

        return htlcContract;
    }

    /// Check this method cannot receive ethers (opposite of ETHPool)
    /// @inheritdoc PoolBase
    function mintHTLC(bytes32 _hash, uint256 _amount) override payable external {
        if (msg.value != 0) {
            revert CannotSendEthers();
        }

        checkAmountWithDecimals(_amount);

        _mintHTLC(_hash, _amount, _chargeableHTLCLockTime());
    }

    /// Create HTLC token with fee towards the pool's safety module
    /// The amount of the HTLC is then reduced by the pool's safety module rate
    /// The recipients will be the pool's reserve address and safety module's address
    function _createChargeableHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) override internal returns (IHTLC) {
        uint256 _fee = swapFee(_amount);
        ChargeableHTLC_ERC htlcContract = new ChargeableHTLC_ERC(token, _amount - _fee, _hash, _lockTime, payable(reserveAddress), payable(safetyModuleAddress), _fee);
        return htlcContract;
    }

    function checkAmountWithDecimals(uint256 _amount) view private {
        // Make sure the decimals matches the Archethic's decimal policy about 10e8. (The trailing decimals must be assigned to 0)
        uint8 _tokenDecimals = token.decimals();
        if (_tokenDecimals > 8) {
            uint8 mod = _tokenDecimals - 8;
            if(_amount % (10 ** mod) != 0) {
                revert InvalidAmount();
            }
        }
    }
}
