import Archethic, { Crypto, Utils } from "archethic"
import config from "./config.js"

const env = config.environments.local

const args = []
process.argv.forEach(function(val, index, _array) { if (index > 1) { args.push(val) } })

if (args.length != 5) {
  console.log("Missing arguments")
  console.log("Usage: node deploy_htlc.js [\"UCO\" | tokenAddress] [htlcSeed] [endTime] [amount] [secretHash]")
  process.exit(1)
}

main()

async function main() {
  const endpoint = env.endpoint
  const userSeed = env.userSeed
  const factorySeed = env.factorySeed

  const token = args[0]
  const seed = args[1]
  const endTime = parseInt(args[2])
  const amount = parseFloat(args[3])
  const secretHash = args[4]

  const poolSeed = Crypto.hash(token).slice(1)
  const tokenAddress = (token == "UCO") ? "UCO" : Utils.uint8ArrayToHex(Crypto.deriveAddress(poolSeed, 1))

  const poolGenesisAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(poolSeed, 0))
  const factoryGenesisAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(factorySeed, 0))
  const userAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(userSeed, 0))

  const archethic = new Archethic(endpoint)
  await archethic.connect()

  const params = [endTime, userAddress, poolGenesisAddress, secretHash, tokenAddress, amount]
  const htlcCode = await archethic.network.callFunction(factoryGenesisAddress, "get_chargeable_htlc", params)

  const storageNonce = await archethic.network.getStorageNoncePublicKey()
  const { encryptedSeed, authorizedKeys } = encryptSeed(seed, storageNonce)

  const htlcGenesisAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(seed, 0))
  console.log("Chargeable HTLC genesis address:", htlcGenesisAddress)
  const index = await archethic.transaction.getTransactionIndex(htlcGenesisAddress)

  // Get faucet before sending transaction
  // await requestFaucet(endpoint, poolGenesisAddress)

  const tx = archethic.transaction.new()
    .setType("contract")
    .setCode(htlcCode)
    .addRecipient(poolGenesisAddress, "request_funds", [endTime, amount, userAddress, secretHash])
    .addOwnership(encryptedSeed, authorizedKeys)
    .build(seed, index)
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

function encryptSeed(seed, storageNonce) {
  const aesKey = Crypto.randomSecretKey()
  const encryptedSeed = Crypto.aesEncrypt(seed, aesKey)
  const encryptedAesKey = Crypto.ecEncrypt(aesKey, storageNonce)
  const authorizedKeys = [{ encryptedSecretKey: encryptedAesKey, publicKey: storageNonce }]
  return { encryptedSeed, authorizedKeys }
}
