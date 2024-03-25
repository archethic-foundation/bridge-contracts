const { ethers } = require("hardhat");
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function promptAddress() {
  return new Promise((r) => {
    readline.question("HLTC contract's address: ", (input) => {
      r(input);
    });
  });
}

async function main() {
  const contractAddress = await promptAddress();
  const htlc = await ethers.getContractAt(
    "ChargeableHTLC_ETH",
    contractAddress,
  );

  const x = await htlc.refund();
  console.log(x);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
