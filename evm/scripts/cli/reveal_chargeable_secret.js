const { ethers } = require("hardhat");
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function promptAddress() {
  return new Promise((r) => {
    readline.question("Contract's address: ", (input) => {
      r(input);
    });
  });
}

async function promptSecret() {
  return new Promise((r) => {
    readline.question("Secret (with 0x): ", (input) => {
      r(input);
    });
  });
}

async function promptSignature() {
  return new Promise((resolve) => {
    readline.question("Signature.r: ", (r) => {
      readline.question("Signature.s: ", (s) => {
        readline.question("Signature.v: ", (v) => {
          resolve({ r, s, v: parseInt(v) });
        });
      });
    });
  });
}

async function main() {
  const contractAddress = await promptAddress();
  const secret = await promptSecret();
  const signature = await promptSignature();

  const htlc = await ethers.getContractAt(
    "ChargeableHTLC_ERC",
    contractAddress,
  );

  return htlc.withdraw(secret, signature.r, signature.s, signature.v)
    .then(() => console.log("Withdraw successful"))
    .catch(er => console.log(er.message))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
