const hre = { ethers, upgrades, network } = require("hardhat");

async function main() {
  const tokenSymbol = process.env["TOKEN"]
  if (network.name != "localhost" && tokenSymbol === undefined) {
    throw "TOKEN is not defined"
  }

  const { archethicPoolSigner, tokenAddress, multisigAddress } = await poolConfiguration(tokenSymbol)

  const lockTimePeriod = 7200; // 2H

  const ERCPool = await ethers.getContractFactory("ERCPool");

  const accounts = await ethers.getSigners()

  const instance = await upgrades.deployProxy(ERCPool, [
    archethicPoolSigner,
    lockTimePeriod,
    tokenAddress,
    false,
    multisigAddress || accounts[0].address
  ]);

  console.log("Transaction:", instance.deploymentTransaction().hash)
  console.log(`ERC pool deployed at: ${await instance.getAddress()}`)
  if (multisigAddress) {
    console.log(`You have to accept the ownership using the multisig wallet (${multisigAddress}) to allow further upgrades`)
  }
}

async function poolConfiguration(tokenSymbol) {
  if (network.name == "localhost") {
    const contract = await ethers.deployContract("DummyToken", [ethers.parseEther('200000')])
    console.log(`Deployed token at: ${await contract.getAddress()}`)

    return {
      archethicPoolSigner: '0xcb2276e4760757976438922aaeb0e03114d5b45f',
      tokenAddress: await contract.getAddress()
    }
  }

  const config = hre.network.config
  const { archethicPoolSigner, token, multisig } = config[tokenSymbol]
  return {
    archethicPoolSigner: archethicPoolSigner,
    tokenAddress: token,
    multisigAddress: multisig
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1)
  });
