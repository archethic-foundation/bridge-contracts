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

  const htlc = await ethers.getContractAt("SignedHTLC_ERC", contractAddress);

  const x = await htlc.refund(secret, signature.r, signature.s, signature.v);
  console.log(x);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
