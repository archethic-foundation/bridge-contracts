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

async function promptReserveAddress() {
  return new Promise((r) => {
    readline.question(
      "Reserve's address [default: 0x4Cd7ce379953FeDd88938a9a4385f8D2bd77BD1d]: ",
      (input) => {
        if (input == "") return r("0x4Cd7ce379953FeDd88938a9a4385f8D2bd77BD1d");

        r(input);
      },
    );
  });
}

async function promptSafetyModuleAddress() {
  return new Promise((r) => {
    readline.question(
      "SafetyModule's address [default: 0x37f82d5cD6e75F9270eACab4dfacEeB881259722]: ",
      (input) => {
        if (input == "") return r("0x37f82d5cD6e75F9270eACab4dfacEeB881259722");

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

async function promptPoolCap() {
  return new Promise((r) => {
    readline.question("Pool cap [default: 200]: ", (input) => {
      if (input == "") return r(ethers.parseEther("200"));

      r(ethers.parseEther(input));
    });
  });
}

async function main() {
  const tokenAddress = await promptTokenAddress();
  const reserveAddress = await promptReserveAddress();
  const safetyModuleAddress = await promptSafetyModuleAddress();
  const poolSigner = await promptPoolSigner();
  const poolCap = await promptPoolCap();

  // not very useful to prompt this
  const safetyModuleFeeRate = 5; // 0.05%
  const lockTimePeriod = 7200; // 2H

  const ERCPool = await ethers.getContractFactory("ERCPool");
  const accounts = await ethers.getSigners();
  const instance = await upgrades.deployProxy(ERCPool, [
    reserveAddress,
    safetyModuleAddress,
    safetyModuleFeeRate,
    poolSigner,
    poolCap,
    lockTimePeriod,
    tokenAddress,
    accounts[0].address,
  ]);

  console.log(`ERC20 Pool deployed at: ${await instance.getAddress()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
