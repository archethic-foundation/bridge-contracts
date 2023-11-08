const { ethers } = require("hardhat");
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout
})

async function promptAddress() {
  return new Promise(r => {
    readline.question("Contract's address: ", input => {
      r(input)
    })
  })
}

async function promptSecret() {
  return new Promise(r => {
    readline.question("Secret (with 0x): ", input => {
      r(input)
    })
  })
}

async function main() {
  const contractAddress = await promptAddress()
  const secret = await promptSecret()

  const htlc = await ethers.getContractAt("HTLCBase", contractAddress)

  await htlc.withdraw(secret)
  console.log("Withdraw successful")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1)
  });
