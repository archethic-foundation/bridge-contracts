// SPDX-License-Identifier: GNU AGPLv3
pragma solidity 0.8.21;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IERC20Mintable is IERC20, IERC20Metadata {
    function burn(uint256 amount) external;

    function mint(address to, uint256 amount) external;
}
