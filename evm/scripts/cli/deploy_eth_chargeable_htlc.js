const { ethers } = require("hardhat");
const crypto = require("crypto")
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout
})

async function promptAmount() {
  return new Promise(r => {
    readline.question("Amount: ", input => {
      r(ethers.parseEther(input))
    })
  })
}

async function promptPoolAddress() {
  return new Promise(r => {
    readline.question("ETH pool's address [default: 0x39C9DBD60B0eAF256Ebc509D2b837d508dD4F2Da]: ", input => {
      if (input == "")
        return r("0x39C9DBD60B0eAF256Ebc509D2b837d508dD4F2Da")

      r(input)
    })
  })
}


async function main() {
  const amount = await promptAmount()
  const poolAddress = await promptPoolAddress()
  const secret = crypto.randomBytes(32)
  const hash = "0x" + crypto.createHash("sha256").update(secret).digest("hex")

  const pool = await ethers.getContractAt("ETHPool", poolAddress)

  const tx = await pool.mintHTLC(hash, amount, { value: amount })
  const contractAddress = await pool.mintedSwap(hash)
  const htlc = await ethers.getContractAt("HTLCBase", contractAddress)

  console.log("tx address:", tx.hash)
  console.log("contract address:", contractAddress)
  console.log("=================")
  console.log("secret:", "0x" + secret.toString("hex"))
  console.log("hash:", hash)
  console.log("end time:", await htlc.lockTime())
  console.log("amount:", ethers.formatEther(await htlc.amount()))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1)
  });

