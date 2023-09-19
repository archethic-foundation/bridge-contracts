// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;

import "../../HTLC/SignedHTLC_ERC.sol";
import "../../HTLC/ChargeableHTLC_ERC.sol";
import "../../../interfaces/IPool.sol";

library ERCPool_HTLCDeployer {
  
    function provisionHTLC(bytes32 _hash, uint256 _amount, uint _lockTime, IERC20 _token, IPool _pool) external returns (SignedHTLC_ERC) {
        SignedHTLC_ERC htlcContract = new SignedHTLC_ERC(msg.sender, _token, _amount, _hash, _lockTime, _pool);
        _token.transfer(address(htlcContract), _amount);
        return htlcContract;
    }

    function mintHTLC(bytes32 _hash, uint256 _amount, uint _lockTime, IERC20 _token, IPool _pool) external returns (ChargeableHTLC_ERC) {
        ChargeableHTLC_ERC htlcContract = new ChargeableHTLC_ERC(_token, _amount, _hash, _lockTime, _pool);
        return htlcContract;
    }
}