const { ethers } = require("hardhat");

async function main() {
  const poolAddress = process.env["PROXY_ADDRESS"]
  if (poolAddress === undefined) {
      throw "PROXY_ADDRESS is not defined"
  }

  let poolInstance = await ethers.getContractAt("PoolBase", poolAddress)

  const reserveAddress = await poolInstance.reserveAddress()
  const safetyModuleAddress = await poolInstance.safetyModuleAddress()

  try {
    poolInstance = await ethers.getContractAt("ERCPool", poolAddress)
    const tokenAddress = await poolInstance.token()
    const token = await ethers.getContractAt("ERC20", tokenAddress)

    const result = await Promise.all( [
      token.balanceOf(poolAddress),
      token.balanceOf(reserveAddress),
      token.balanceOf(safetyModuleAddress)
    ])

    console.log("Token: ", await token.name())
    console.log("Pool balance:", ethers.formatEther(result[0]))
    console.log("Reserve balance:", ethers.formatEther(result[1]))
    console.log("Safety module balance:", ethers.formatEther(result[2]))
  }
  catch(e){
    const result = await Promise.all([
      ethers.provider.getBalance(poolAddress),
      ethers.provider.getBalance(reserveAddress),
      ethers.provider.getBalance(safetyModuleAddress)
    ])

    console.log("Pool balance:", ethers.formatEther(result[0]))
    console.log("Reserve balance:", ethers.formatEther(result[1]))
    console.log("Safety module balance:", ethers.formatEther(result[2]))
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1)
  });
