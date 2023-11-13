const hre = { ethers } = require("hardhat");

async function main() {
  const config = hre.network.config

  const token = await ethers.getContractAt("ERC20", config.uco.token)

  const balances = [
    ethers.provider.getBalance(config.natif.pool),
    ethers.provider.getBalance(config.natif.reserve),
    ethers.provider.getBalance(config.natif.safety),
    token.balanceOf(config.uco.pool),
    token.balanceOf(config.uco.reserve),
    token.balanceOf(config.uco.safety)
  ]

  const result = await Promise.all(balances)

  console.log("Natif token ", config.natif.token)
  console.log("Pool balance:", ethers.formatEther(result[0]), config.natif.token)
  console.log("Reserve balance:", ethers.formatEther(result[1]), config.natif.token)
  console.log("Safety module balance:", ethers.formatEther(result[2]), config.natif.token)

  console.log("UCO token")
  console.log("Pool balance:", ethers.formatEther(result[3]), "UCO")
  console.log("Reserve balance:", ethers.formatEther(result[4]), "UCO")
  console.log("Safety module balance:", ethers.formatEther(result[5]), "UCO")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1)
  });
