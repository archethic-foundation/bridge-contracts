const { ethers } = require("hardhat");

async function main() {
  const poolAddress = process.env["PROXY_ADDRESS"]
  if (poolAddress === undefined) {
      throw "PROXY_ADDRESS is not defined"
  }

  let poolInstance = await ethers.getContractAt("PoolBase", poolAddress)

  try {
    poolInstance = await ethers.getContractAt("ERCPool", poolAddress)
    const tokenAddress = await poolInstance.token()
    const token = await ethers.getContractAt("ERC20", tokenAddress)

    const result = await Promise.all( [
      token.balanceOf(poolAddress),
    ])

    console.log("Token: ", await token.name())
    console.log("Pool balance:", ethers.formatEther(result[0]))
  }
  catch(e){
    const result = await Promise.all([
      ethers.provider.getBalance(poolAddress),
    ])

    console.log("Pool balance:", ethers.formatEther(result[0]))
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1)
  });
