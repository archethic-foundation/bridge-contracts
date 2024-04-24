const { ethers } = require("hardhat");
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function requestContractAddress() {
  return new Promise((r) => {
    readline.question("HTLC address: ", (input) => {
      readline.close();
      r(input);
    });
  });
}

async function main() {
  const htlcAddress = await requestContractAddress();
  const htlcContract = await ethers.getContractAt("HTLCBase", htlcAddress);

  const tx = await htlcContract.refund();

  console.log("tx address:", tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
