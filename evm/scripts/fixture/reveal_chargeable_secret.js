const { ethers } = require("hardhat");
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout
})

async function requestAddress() {
  return new Promise(r => {
    readline.question("contract address: ", input => {
      r(input)
    })
  })
}

async function requestSecret() {
  return new Promise(r => {
    readline.question("secret: ", input => {
      readline.close()
      r(input)
    })
  })
}

async function main() {
  const contractAddress = await requestAddress()
  const secret = await requestSecret()

  const htlc = await ethers.getContractAt("HTLCBase", contractAddress)

  htlc.withdraw(secret)
    .then(() => console.log("Withdraw successfull"))
    .catch(er => console.log(er.message))
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

