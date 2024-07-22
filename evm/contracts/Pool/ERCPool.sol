// SPDX-License-Identifier: GNU AGPLv3
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

    mapping(address => Swap[]) _swapsByOwner;

    /// @notice Notifies a change about the pool's ERC20 token
    event TokenChanged(address indexed _token);

    /// @notice Throws this pool cannot received ethers
    error CannotSendEthers();

    /// @notice Throws when the token address is invalid
    error InvalidToken();

    function initialize(address _archPoolSigner, uint256 _lockTimePeriod, ERC20 _token, address _multisig) initializer external {
        __Pool_Init(_archPoolSigner, _lockTimePeriod, _multisig);
        if (address(_token) == address(0)) {
            revert InvalidToken();
        }
        token = _token;
	}

    /// @notice Update the pool's asset ERC20 (Restricted to the pool's owner)
    /// @dev TokenChanged event is emitted once done
    function setToken(ERC20 _token) onlyOwner external {
        if (address(_token) == address(0)) {
            revert InvalidToken();
        }
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

    /// Create HTLC token where funds are delivered by the user
    function _createChargeableHTLC(bytes32 _hash, uint256 _amount, uint _lockTime) override internal returns (IHTLC) {
        ChargeableHTLC_ERC htlcContract = new ChargeableHTLC_ERC(token, _amount, _hash, _lockTime, address(this), archethicPoolSigner);
        SafeERC20.safeTransferFrom(token, msg.sender, address(htlcContract), _amount);

        // Ensure the amount received by the HTLC contract is the expected one
        // This prevent using fee-on-transfer tokens
        uint256 htlcBalance = token.balanceOf(address(htlcContract));
        require(htlcBalance == _amount, "Amount sent/received are not the same");

        return htlcContract;
    }

    function checkAmountWithDecimals(uint256 _amount) view private {
        // Make sure the decimals matches the Archethic's decimal policy about 1e8. (The trailing decimals must be assigned to 0)
        uint8 _tokenDecimals = token.decimals();
        if (_tokenDecimals > 8) {
            uint8 mod = _tokenDecimals - 8;
            if(_amount % (10 ** mod) != 0) {
                revert InvalidAmount();
            }
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
