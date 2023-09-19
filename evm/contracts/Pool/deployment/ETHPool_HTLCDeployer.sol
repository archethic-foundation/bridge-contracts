// SPDX-License-Identifier: AGPL-3
pragma solidity ^0.8.13;

import "../../HTLC/SignedHTLC_ETH.sol";
import "../../HTLC/ChargeableHTLC_ETH.sol";
import "../../../interfaces/IPool.sol";


library ETHPool_HTLCDeployer {

   function provisionHTLC(bytes32 _hash, uint256 _amount, uint _lockTime, IPool _pool) external returns (SignedHTLC_ETH) {
        SignedHTLC_ETH htlcContract = new SignedHTLC_ETH(payable(msg.sender), _amount, _hash, _lockTime, _pool);
        (bool sent,) = address(htlcContract).call{value: _amount}("");
        require(sent);

        delete sent;

        return htlcContract;
    }

    function mintHTLC(bytes32 _hash, uint256 _amount, uint _lockTime, IPool _pool) external returns (ChargeableHTLC_ETH) {
        ChargeableHTLC_ETH htlcContract = new ChargeableHTLC_ETH(_amount, _hash, _lockTime, _pool);
        return htlcContract;
    }
}