// SPDX-License-Identifier: AGPL-3
pragma solidity 0.8.21;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./HTLC_ETH.sol";
import "../../interfaces/IPool.sol";

/// @title HTLC contract with chargeable fee towards pool's safety module
/// @author Archethic Foundation
contract ChargeableHTLC_ETH is HTLC_ETH {

    /// @notice Return the fee's amount
    uint256 public immutable fee;

    /// @notice Return the amount to refill the pool
    uint256 public refillAmount;

    /// @notice Return the amount to withdraw to the main's recipient
    uint256 public withdrawAmount;

    /// @notice Return the satefy module destination wallet
    address public immutable safetyModuleAddress;

    /// @notice Return the refill address to send the pool's capacity below its cap
    address public immutable refillAddress;

    /// @notice Returns the Archethic's pool signer address
    address public immutable poolSigner;

    /// @notice Throws when the Archethic's pool signature is invalid
    error InvalidSignature();

    /// @dev Create HTLC instance but delegates funds control after the HTLC constructor
    /// @dev This way we can check funds with decorrelation between amount/fee and the sent ethers.
    constructor(
        uint256 _amount,
        bytes32 _hash,
        uint _lockTime,
        address payable _reserveAddress,
        address payable _safetyModuleAddress,
        uint256 _fee,
        address _refillAddress,
        address _poolSigner
    ) payable HTLC_ETH(_reserveAddress, _amount, _hash, _lockTime, true) {
        fee = _fee;
        safetyModuleAddress = _safetyModuleAddress;
        from = tx.origin;
        refillAddress = _refillAddress;
        poolSigner = _poolSigner;

        // We check if the received ethers adds the deducted amount from the fee
        _assertReceivedFunds(_amount + _fee);
    }

     /// @dev Check whether the HTLC have enough tokens to cover fee + amount
    function _enoughFunds() internal view override returns (bool) {
        return address(this).balance == (amount + fee);
    }

    /// @dev Send ethers to the HTLC's recipient and safety module fee
    function _transferAsWithdraw() internal override {
        bool sent = false;
        uint _fee = fee;
        address _refillAddress = refillAddress;

        IPool pool = IPool(_refillAddress);
        uint256 _poolCap = pool.poolCap();
        uint256 _poolBalance = _refillAddress.balance;

        uint256 _withdrawAmount = amount;
        uint256 _refillAmount;

        if (_poolBalance < _poolCap) {
            uint256 _poolCapacity = _poolCap - _poolBalance;
            if(_withdrawAmount > _poolCapacity) {
                _withdrawAmount = _withdrawAmount - _poolCapacity;
                _refillAmount = _poolCapacity;
            } else {
                _refillAmount = _withdrawAmount;
                _withdrawAmount = 0;
            }
        }

        if (_fee > 0) {
            (sent, ) = safetyModuleAddress.call{value: _fee}("");
            require(sent, "ETH transfer failed - withdraw/safety");
        }

        if (_withdrawAmount > 0) {
            withdrawAmount = _withdrawAmount;
            (sent, ) = recipient.call{value: _withdrawAmount}("");
            require(sent, "ETH transfer failed - withdraw/recipient");
        }

        if (_refillAmount > 0) {
            refillAmount = _refillAmount;
            (sent, ) = _refillAddress.call{value: _refillAmount}("");
            require(sent, "ETH transfer failed - withdraw/refill");
        }
    }

    /// @dev Send back ethers (amount + fee) to the HTLC's creator
    function _transferAsRefund() internal override {
        (bool sent, ) = from.call{value: amount + fee}("");
        require(sent, "ETH transfer failed - refund");
    }

    function withdraw(bytes32 _secret, bytes32 _r, bytes32 _s, uint8 _v) external {
        bytes32 sigHash = ECDSA.toEthSignedMessageHash(hash);
        address signer = ECDSA.recover(sigHash, _v, _r, _s);

        if (signer != poolSigner) {
            revert InvalidSignature();
        }

        delete sigHash;
        delete signer;

        _withdraw(_secret);
    }

    /// @dev Prevent to use the direct withdraw's function without the signature
    function withdraw(bytes32) override pure external {
        revert InvalidSignature();
    }
}
