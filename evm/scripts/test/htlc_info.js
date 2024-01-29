const { ethers } = require("hardhat");
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout
})

async function requestContractAddress() {
  return new Promise(r => {
    readline.question("HTLC address: ", input => {
      readline.close()
      r(input)
    })
  })
}

async function main() {
  const htlcAddress = await requestContractAddress()
  const htlcContract = await ethers.getContractAt("HTLCBase", htlcAddress)

  const lockTime = await htlcContract.lockTime()
  console.log(lockTime)
  const secretHash = await htlcContract.hash()
  const amount = await htlcContract.amount()

  let status
  const htlcStatus = await htlcContract.status()
  switch(htlcStatus.toString()) {
    case "0": status = "pending"; break;
    case "1": status = "withdrawn"; break;
    case "2": status = "refunded"; break;
  }

  console.log("==============")
  console.log("HTLC's endtime: ", lockTime.toString())
  console.log("HTLC's hash: ", secretHash)
  console.log("HTLC's amount: ", ethers.formatEther(amount))
  console.log("HTLC's status: ", status)
  console.log("HTLC's funding status", await htlcContract.enoughFunds() ? "Enough funds" : "Insufficient funds")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });

