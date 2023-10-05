import fs from "fs"
import Archethic, { Crypto, Utils } from "archethic"
import config from "./config.js"

const env = config.environments.local

const args = []
process.argv.forEach(function(val, index, _array) { if (index > 1) { args.push(val) } })

if (args.length != 1) {
  console.log("Missing arguments")
  console.log("Usage: node update_pool.js [\"UCO\" | \"tokenSymbol\"]")
  process.exit(1)
}

main()

async function main() {
  const endpoint = env.endpoint
  const factorySeed = env.factorySeed
  const masterSeed = env.masterSeed

  const token = args[0]
  const poolSeed = Crypto.hash(token).slice(1)
  const stateSeed = Crypto.hash(token + "state").slice(1)
  const stateContractAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(stateSeed, 0))

  const archethic = new Archethic(endpoint)
  await archethic.connect()


  const poolGenesisAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(poolSeed, 0))
  const poolCode = (token == "UCO") ?
    getUCOPoolCode(poolGenesisAddress, factorySeed, masterSeed) :
    getTokenPoolCode(poolSeed, poolGenesisAddress, factorySeed, stateContractAddress, masterSeed)

  const masterGenesisAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(masterSeed, 0))
  console.log("Master genesis address:", masterGenesisAddress)
  const index = await archethic.transaction.getTransactionIndex(masterGenesisAddress)

  const updateTx = archethic.transaction.new()
    .setType("transfer")
    .addRecipient(poolGenesisAddress, "update_code", [poolCode])
    .build(masterSeed, index)
    .originSign(Utils.originPrivateKey)

  updateTx.on("fullConfirmation", async (_confirmations) => {
    const txAddress = Utils.uint8ArrayToHex(updateTx.address)
    console.log("Transaction validated !")
    console.log("Address:", txAddress)
    console.log(endpoint + "/explorer/transaction/" + txAddress)
    process.exit(0)
  }).on("error", (context, reason) => {
    console.log("Error while sending pool transaction")
    console.log("Contest:", context)
    console.log("Reason:", reason)
    process.exit(1)
  }).send()
}

function getUCOPoolCode(poolGenesisAddress, factorySeed, masterSeed) {
  let poolCode = fs.readFileSync("./contracts/uco_pool.exs", "utf8")

  return replaceCommonTemplate(poolCode, poolGenesisAddress, factorySeed, masterSeed)
}

function getTokenPoolCode(poolSeed, poolGenesisAddress, factorySeed, stateContractAddress, masterSeed) {
  // First pool transaction create the token, so we calculate the token address as
  // the first transaction if the chain
  const tokenAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(poolSeed, 1))

  let poolCode = fs.readFileSync("./contracts/token_pool.exs", "utf8")
  // Replace token address
  poolCode = poolCode.replaceAll("#TOKEN_ADDRESS#", "0x" + tokenAddress)
  // Replace state address
  poolCode = poolCode.replaceAll("#STATE_ADDRESS#", "0x" + stateContractAddress)

  return replaceCommonTemplate(poolCode, poolGenesisAddress, factorySeed, masterSeed)
}

function replaceCommonTemplate(poolCode, poolGenesisAddress, factorySeed, masterSeed) {
  // Replace genesis pool address
  poolCode = poolCode.replaceAll("#POOL_ADDRESS#", "0x" + poolGenesisAddress)
  // Replace factory address
  const factoryAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(factorySeed, 0))
  poolCode = poolCode.replaceAll("#FACTORY_ADDRESS#", "0x" + factoryAddress)
  // Replace master address
  const masterAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(masterSeed, 0))
  poolCode = poolCode.replaceAll("#MASTER_GENESIS_ADDRESS#", "0x" + masterAddress)
  // Replace available chain ids
  const chainIds = []
  for (let network of env.availableEvmNetworks) {
    const chainId = config.evmNetworks[network].chainId
    chainIds.push(chainId)
  }
  return poolCode.replaceAll("#CHAIN_IDS#", chainIds)
}

