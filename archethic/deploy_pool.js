import fs from "fs"
import Archethic, { Crypto, Utils } from "archethic"
import config from "./config.js"

const env = config.environments.local

const args = []
process.argv.forEach(function(val, index, _array) { if (index > 1) { args.push(val) } })

if (args.length != 1) {
  console.log("Missing arguments")
  console.log("Usage: node deploy_pool.js [\"UCO\" | \"tokenSymbol\"]")
  process.exit(1)
}

main()

async function main() {
  const endpoint = env.endpoint
  const factorySeed = env.factorySeed

  const token = args[0]
  const poolSeed = Crypto.hash(token).slice(1)
  const stateSeed = Crypto.hash(token + "state").slice(1)
  const stateContractAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(stateSeed, 0))

  const archethic = new Archethic(endpoint)
  await archethic.connect()

  const poolGenesisAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(poolSeed, 0))
  console.log("Pool genesis address:", poolGenesisAddress)

  const poolCode = (token == "UCO") ?
    getUCOPoolCode(poolGenesisAddress, factorySeed) :
    getTokenPoolCode(poolSeed, poolGenesisAddress, factorySeed, stateContractAddress)

  const storageNonce = await archethic.network.getStorageNoncePublicKey()
  const { encryptedSeed, authorizedKeys } = encryptSeed(poolSeed, storageNonce)

  const index = await archethic.transaction.getTransactionIndex(poolGenesisAddress)

  const poolTx = archethic.transaction.new()
    .setCode(poolCode)
    .addOwnership(encryptedSeed, authorizedKeys)

  if (token != "UCO") {
    poolTx.setType("token")
      .setContent(getTokenDefinition(token))
      .addUCOTransfer(stateContractAddress, Utils.toBigInt(50))
  } else {
    poolTx.setType("contract")
  }

  poolTx.build(poolSeed, index).originSign(Utils.originPrivateKey)

  poolTx.on("fullConfirmation", async (_confirmations) => {
    const txAddress = Utils.uint8ArrayToHex(poolTx.address)
    console.log("Transaction validated !")
    console.log("Address:", txAddress)
    console.log(endpoint + "/explorer/transaction/" + txAddress)
    if (token != "UCO") {
      deployStateContract(archethic, stateSeed, storageNonce)
        .then(() => process.exit(0))
        .catch(() => process.exit(1))
    } else {
      process.exit(0)
    }
  }).on("error", (context, reason) => {
    console.log("Error while sending pool transaction")
    console.log("Contest:", context)
    console.log("Reason:", reason)
    process.exit(1)
  }).send()
}

function getUCOPoolCode(poolGenesisAddress, factorySeed) {
  let poolCode = fs.readFileSync("./contracts/uco_pool.exs", "utf8")

  return replaceCommonTemplate(poolCode, poolGenesisAddress, factorySeed)
}

function getTokenPoolCode(poolSeed, poolGenesisAddress, factorySeed, stateContractAddress) {
  // First pool transaction create the token, so we calculate the token address as
  // the first transaction if the chain
  const tokenAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(poolSeed, 1))

  let poolCode = fs.readFileSync("./contracts/token_pool.exs", "utf8")
  // Replace token address
  poolCode = poolCode.replaceAll("#TOKEN_ADDRESS#", "0x" + tokenAddress)
  // Replace state address
  poolCode = poolCode.replaceAll("#STATE_ADDRESS#", "0x" + stateContractAddress)

  return replaceCommonTemplate(poolCode, poolGenesisAddress, factorySeed)
}

function replaceCommonTemplate(poolCode, poolGenesisAddress, factorySeed) {
  // Replace genesis pool address
  poolCode = poolCode.replaceAll("#POOL_ADDRESS#", "0x" + poolGenesisAddress)
  // Replace protocol fee address
  const factoryAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(factorySeed, 0))
  poolCode = poolCode.replaceAll("#FACTORY_ADDRESS#", "0x" + factoryAddress)
  // Replace available chain ids
  const chainIds = []
  for (let network of env.availableEvmNetworks) {
    const chainId = config.evmNetworks[network].chainId
    chainIds.push(chainId)
  }
  return poolCode.replaceAll("#CHAIN_IDS#", chainIds)
}

function getTokenDefinition(token) {
  return JSON.stringify({
    aeip: [2, 8, 18, 19],
    supply: 1,
    type: "fungible",
    symbol: token,
    name: token,
    allow_mint: true,
    properties: {},
    recipients: [
      {
        to: "00000000000000000000000000000000000000000000000000000000000000000000",
        amount: 1
      }
    ]
  })
}

function encryptSeed(seed, storageNonce) {
  const aesKey = Crypto.randomSecretKey()
  const encryptedSeed = Crypto.aesEncrypt(seed, aesKey)
  const encryptedAesKey = Crypto.ecEncrypt(aesKey, storageNonce)
  const authorizedKeys = [{ encryptedSecretKey: encryptedAesKey, publicKey: storageNonce }]
  return { encryptedSeed, authorizedKeys }
}

async function deployStateContract(archethic, seed, storageNonce) {
  return new Promise(async (resolve, reject) => {
    const genesisAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(seed, 0))
    const { encryptedSeed, authorizedKeys } = encryptSeed(seed, storageNonce)

    const code = fs.readFileSync("./contracts/state_contract.exs", "utf8")

    const index = await archethic.transaction.getTransactionIndex(genesisAddress)

    const tx = archethic.transaction.new()
      .setType("contract")
      .setCode(code)
      .setContent("{}")
      .addOwnership(encryptedSeed, authorizedKeys)
      .build(seed, index).originSign(Utils.originPrivateKey)

    tx.on("fullConfirmation", async (_confirmations) => {
      resolve()
    }).on("error", (context, reason) => {
      console.log("Error while sending state transaction")
      console.log("Contest:", context)
      console.log("Reason:", reason)
      reject()
    }).send()
  })
}
