// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DummyTokenFee is ERC20 {
    constructor(uint256 initialSupply) ERC20("DummyTokenFee", "DTKF") {
        _mint(msg.sender, initialSupply);
    }

    function transfer(
        address to,
        uint256 amount
    ) public override returns (bool) {
        address owner = msg.sender;
        _transfer(owner, to, amount - 10);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        address spender = msg.sender;
        uint256 finalAmount = amount - 10;
        _spendAllowance(from, spender, finalAmount);
        _transfer(from, to, finalAmount);
        return true;
    }
}

