const { ethers, upgrades, network } = require("hardhat");
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function promptTokenAddress() {
  return new Promise((r) => {
    readline.question(
      "Token's contract address [default: 0x8f1c3e24A3F67745570ceaECdF8dEbDAB4951b8D]: ",
      (input) => {
        if (input == "") return r("0x8f1c3e24A3F67745570ceaECdF8dEbDAB4951b8D");

        r(input);
      },
    );
  });
}

// pool signer is generated via this CLI:
//
// node bridge derive_eth_address --token UCO
async function promptPoolSigner() {
  return new Promise((r) => {
    readline.question(
      "Pool signer [default: 0xcb2276e4760757976438922aaeb0e03114d5b45f]: ",
      (input) => {
        if (input == "") return r("0xcb2276e4760757976438922aaeb0e03114d5b45f");

        r(input);
      },
    );
  });
}

async function main() {
    const tokenAddress = await promptTokenAddress()
    const poolSigner = await promptPoolSigner()

    // not very useful to prompt this
    const lockTimePeriod = 7200; // 2H

    const accounts = await ethers.getSigners()

    const ERCPool = await ethers.getContractFactory("ERCPool");
    const instance = await upgrades.deployProxy(ERCPool, [
        poolSigner,
        lockTimePeriod,
        tokenAddress,
        accounts[0].address
    ]);

  console.log(`ERC20 Pool deployed at: ${await instance.getAddress()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
