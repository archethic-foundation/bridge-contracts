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

async function promptTokenAddress() {
  return new Promise(r => {
    readline.question("Token's contract address: ", input => {
      r(input)
    })
  })
}
async function promptPoolAddress() {
  return new Promise(r => {
    readline.question("ERC20 pool's address: ", input => {
      r(input)
    })
  })
}

async function promptTokenName() {
  return new Promise(r => {
    readline.question("Token's definition [default: DummyToken]: ", input => {
      if (input == "")
        return r("DummyToken")

      r(input)
    })
  })
}


async function main() {
  const tokenName = await promptTokenName()
  const amount = await promptAmount()
  const tokenAddr = await promptTokenAddress()
  const poolAddr = await promptPoolAddress()
  const secret = crypto.randomBytes(32)
  const hash = "0x" + crypto.createHash("sha256").update(secret).digest("hex")

  const pool = await ethers.getContractAt("ERCPool", poolAddr)
  const token = await ethers.getContractAt(tokenName, tokenAddr)

  const tx = await pool.mintHTLC(hash, amount)
  await tx.wait()
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

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1)
  });
