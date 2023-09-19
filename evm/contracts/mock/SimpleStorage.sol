// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract SimpleStorage is Initializable {

    uint public value;

    function initialize(uint _value) public initializer {
        value = _value;
    }

    function setValue(uint _value) external {
        value = _value;
    }
}