import Archethic, { Crypto, Utils } from "archethic"
import config from "./config.js"

const env = config.environments.local

const args = []
process.argv.forEach(function(val, index, _array) { if (index > 1) { args.push(val) } })

if (args.length != 3) {
  console.log("Missing arguments")
  console.log("Usage: node provision_htlc.js [\"UCO\" | tokenSymbol] [htlcSeed] [amount]")
  process.exit(1)
}

main()

async function main() {
  const endpoint = env.endpoint
  const userSeed = env.userSeed
  const chainId = env.defaultChainId

  const token = args[0]
  const htlcSeed = args[1]
  const amount = parseFloat(args[2])

  const poolSeed = Crypto.hash(token).slice(1)
  const tokenAddress = (token == "UCO") ? "UCO" : Utils.uint8ArrayToHex(Crypto.deriveAddress(poolSeed, 1))

  const poolGenesisAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(poolSeed, 0))
  const userAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(userSeed, 0))
  const htlcGenesisAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(htlcSeed, 0))

  const archethic = new Archethic(endpoint)
  await archethic.connect()

  const index = await archethic.transaction.getTransactionIndex(userAddress)

  // Get faucet before sending transaction
  // await requestFaucet(endpoint, poolGenesisAddress)

  const tx = archethic.transaction.new()
    .setType("transfer")
    .addRecipient(poolGenesisAddress, "request_secret_hash", [htlcGenesisAddress, amount, userAddress, chainId])

  if (tokenAddress == "UCO") {
    tx.addUCOTransfer(htlcGenesisAddress, Utils.toBigInt(amount))
  } else {
    tx.addTokenTransfer(htlcGenesisAddress, Utils.toBigInt(amount), tokenAddress)
  }

  tx.build(userSeed, index)
    .originSign(Utils.originPrivateKey)

  tx.on("fullConfirmation", (_confirmations) => {
    const txAddress = Utils.uint8ArrayToHex(tx.address)
    console.log("Transaction validated !")
    console.log("Address:", txAddress)
    console.log(endpoint + "/explorer/transaction/" + txAddress)
    process.exit(0)
  }).on("error", (context, reason) => {
    console.log("Error while sending transaction")
    console.log("Contest:", context)
    console.log("Reason:", reason)
    process.exit(1)
  }).send()
}
