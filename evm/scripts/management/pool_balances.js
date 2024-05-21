const { ethers } = require("hardhat");

async function main() {
  const poolAddress = process.env["PROXY_ADDRESS"]
  if (poolAddress === undefined) {
      throw "PROXY_ADDRESS is not defined"
  }

  let poolInstance = await ethers.getContractAt("PoolBase", poolAddress)

  const reserveAddress = await poolInstance.reserveAddress()

  try {
    poolInstance = await ethers.getContractAt("ERCPool", poolAddress)
    const tokenAddress = await poolInstance.token()
    const token = await ethers.getContractAt("ERC20", tokenAddress)

    const result = await Promise.all( [
      token.balanceOf(poolAddress),
      token.balanceOf(reserveAddress)
    ])

    console.log("Token: ", await token.name())
    console.log("Pool balance:", ethers.formatEther(result[0]))
    console.log("Reserve balance:", ethers.formatEther(result[1]))
  }
  catch(e){
    const result = await Promise.all([
      ethers.provider.getBalance(poolAddress),
      ethers.provider.getBalance(reserveAddress)
    ])

    console.log("Pool balance:", ethers.formatEther(result[0]))
    console.log("Reserve balance:", ethers.formatEther(result[1]))
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1)
  });
