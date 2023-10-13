const { ethers } = require("hardhat");
const crypto = require("crypto")
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout
})

async function requestAmount() {
  return new Promise(r => {
    readline.question("amount: ", input => {
      readline.close()
      r(ethers.parseEther(input))
    })
  })
}

async function main() {
  const amount = requestAmount()
  const secret = crypto.randomBytes(32)
  const hash = "0x" + crypto.createHash("sha256").update(secret).digest("hex")

  const pool = await ethers.getContractAt("ERCPool", "0xaa74722D2cB78D4b5e52c2Ee7F12fe08851baa5F")
  const token = await ethers.getContractAt("DummyToken", "0xBdEC1c3Bd0719DBa0B82a06C66EBab35dc71240B")

  const tx = await pool.mintHTLC(hash, amount)
  const contractAddress = await pool.mintedSwap(hash)
  const htlc = await ethers.getContractAt("HTLCBase", contractAddress)

  await token.transfer(contractAddress, amount)

  console.log("tx address:", tx.hash)
  console.log("contract address:", contractAddress)
  console.log("=================")
  console.log("secret:", "0x" + secret.toString("hex"))
  console.log("hash:", hash)
  console.log("end time:", await htlc.lockTime())
  console.log("amount:", ethers.formatEther(await htlc.amount()))
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

