import fs from "fs"
import { Crypto, Utils } from "@archethicjs/sdk"
import config from "../config.js"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONFIRMATION_THRESHOLD = 50

const ucoContractPath = path.resolve(__dirname, "../contracts/uco_pool.exs")
const tokenContractPath = path.resolve(__dirname, "../contracts/token_pool.exs")
const factoryContractPath = path.resolve(__dirname, "../contracts/factory.exs")

export function getGenesisAddress(seed) {
  return Utils.uint8ArrayToHex(Crypto.deriveAddress(seed, 0))
}

export function getServiceGenesisAddress(keychain, service, suffix = "") {
  return Utils.uint8ArrayToHex(keychain.deriveAddress(service, 0, suffix))
}

export function getTokenAddress(keychain, token) {
  return token == "UCO" ?
    "UCO" :
    Utils.uint8ArrayToHex(keychain.deriveAddress(getPoolServiceName(token), 1))
}

export function getPoolInfo(token) {
  return token
}

export function getPoolServiceName(token) {
  return token + "_pool"
}

export function encryptSecret(secret, publicKey) {
  const aesKey = Crypto.randomSecretKey()
  const encryptedSecret = Crypto.aesEncrypt(secret, aesKey)
  const encryptedAesKey = Crypto.ecEncrypt(aesKey, publicKey)
  const authorizedKeys = [{ encryptedSecretKey: encryptedAesKey, publicKey: publicKey }]
  return { encryptedSecret, authorizedKeys }
}

export async function updateKeychain(keychain, archethic) {
  return new Promise(async (resolve, reject) => {
    const keychainGenesisAddress = Crypto.deriveAddress(keychain.seed, 0)
    const transactionChainIndex = await archethic.transaction.getTransactionIndex(keychainGenesisAddress)

    const keychainTx = archethic.account.newKeychainTransaction(keychain, transactionChainIndex)
      .originSign(Utils.originPrivateKey)

    keychainTx.on("requiredConfirmation", async (_confirmations) => {
      const txAddress = Utils.uint8ArrayToHex(keychainTx.address)
      console.log("Keychain transaction validated !")
      console.log("Address:", txAddress)
      console.log(archethic.endpoint.origin + "/explorer/transaction/" + txAddress)
      console.log("=======================")
      resolve()
    }).on("error", (context, reason) => {
      console.log("Error while sending Keychain transaction")
      console.log("Contest:", context)
      console.log("Reason:", reason)
      reject()
    }).send(CONFIRMATION_THRESHOLD)
  })
}

export async function sendTransactionWithFunding(tx, keychain, archethic, fundSeedFrom = undefined) {
  return new Promise(async (resolve, reject) => {
    let { fee } = await archethic.transaction.getTransactionFee(tx)
    fee = Math.trunc(fee * 1.01)

    const txPreviousAddress = "00" + Utils.uint8ArrayToHex(Crypto.hash(tx.previousPublicKey))
    let refillTx = archethic.transaction.new()
      .setType("transfer")
      .addUCOTransfer(txPreviousAddress, fee)

    let fundingGenesisAddress
    if (fundSeedFrom) {
      fundingGenesisAddress = getGenesisAddress(fundSeedFrom)
      const index = await archethic.transaction.getTransactionIndex(Crypto.deriveAddress(fundSeedFrom, 0))
      refillTx.build(fundSeedFrom, index).originSign(Utils.originPrivateKey)
    } else {
      fundingGenesisAddress = getServiceGenesisAddress(keychain, "Master")
      const masterIndex = await archethic.transaction.getTransactionIndex(keychain.deriveAddress("Master"))
      refillTx = keychain.buildTransaction(refillTx, "Master", masterIndex).originSign(Utils.originPrivateKey)
    }

    tx.on("requiredConfirmation", async (_confirmations) => {
      const txAddress = Utils.uint8ArrayToHex(tx.address)
      console.log("Transaction validated !")
      console.log("Address:", txAddress)
      console.log(archethic.endpoint.origin + "/explorer/transaction/" + txAddress)
      resolve()
    }).on("error", (context, reason) => {
      console.log("Error while sending transaction")
      console.log("Context:", context)
      console.log("Reason:", reason)
      reject()
    })

    console.log("Sending funds to previous transaction address ...")
    console.log("=======================")

    refillTx.on("requiredConfirmation", async (_confirmations) => {
      tx.send(CONFIRMATION_THRESHOLD)
    }).on("error", (context, reason) => {
      console.log("Error while sending UCO fee transaction")
      console.log("Funding genesis address:", fundingGenesisAddress)
      console.log("Context:", context)
      console.log("Reason:", reason)
      reject()
    }).send(CONFIRMATION_THRESHOLD)
  })
}

export function getTokenDefinition(token) {
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

export function getFactoryCode(keychain) {
  // Replace protocol fee address
  const code = fs.readFileSync(factoryContractPath, "utf8")
  const protocolFeeAddress = getServiceGenesisAddress(keychain, "ProtocolFee")
  return code.replaceAll("@PROTOCOL_FEE_ADDRESS", "0x" + protocolFeeAddress)
}

export function getPoolCode(envName, keychain, token) {
  return (token == "UCO") ?
    getUCOPoolCode(keychain, token, envName) :
    getTokenPoolCode(keychain, token, envName)
}

function getUCOPoolCode(keychain, token, envName) {
  let poolCode = fs.readFileSync(ucoContractPath, "utf8")
  return replaceCommonTemplate(poolCode, keychain, token, envName)
}

function getTokenPoolCode(keychain, token, envName) {
  // First pool transaction create the token, so we calculate the token address as
  // the first transaction if the chain
  const serviceName = getPoolServiceName(token)
  const tokenAddress = Utils.uint8ArrayToHex(keychain.deriveAddress(serviceName, 1))

  let poolCode = fs.readFileSync(tokenContractPath, "utf8")
  // Replace token address
  poolCode = poolCode.replaceAll("@TOKEN_ADDRESS", "0x" + tokenAddress)

  return replaceCommonTemplate(poolCode, keychain, token, envName)
}

function replaceCommonTemplate(poolCode, keychain, token, envName) {
  const availableEvmNetworks = config.pools[token].availableEvmNetworks[envName]

  // Replace genesis pool address
  const poolServiceName = getPoolServiceName(token)
  const poolGenesisAddress = getServiceGenesisAddress(keychain, poolServiceName)
  poolCode = poolCode.replaceAll("@POOL_ADDRESS", "0x" + poolGenesisAddress)

  // Replace factory address
  const factoryAddress = getServiceGenesisAddress(keychain, "Factory")
  poolCode = poolCode.replaceAll("@FACTORY_ADDRESS", "0x" + factoryAddress)

  // Replace master address
  const masterAddress = getServiceGenesisAddress(keychain, "Master")
  poolCode = poolCode.replaceAll("@MASTER_GENESIS_ADDRESS", "0x" + masterAddress)

  // Replace available chain ids
  const chainIds = availableEvmNetworks.map(network => config.evmNetworks[network].chainId)
  poolCode = poolCode.replaceAll("@CHAIN_IDS", chainIds)

  // Replace endpoint conditions
  const conditions = get_evm_data_conditions(token, availableEvmNetworks)
  return poolCode.replaceAll("@EVM_DATA_CONDITIONS", conditions)
}

function get_evm_data_conditions(token, availableEvmNetworks) {
  return availableEvmNetworks
    .map(network => {
      const { endpoints, chainId } = config.evmNetworks[network]
      const { proxyAddress, decimals } = config.evmNetworks[network].tokens[token]

      return `
  if chain_id == ${chainId} do
    data = Map.set(data, "endpoints", ${JSON.stringify(endpoints)})
    data = Map.set(data, "proxy_address", "${proxyAddress.toLowerCase()}")
    data = Map.set(data, "decimals", ${decimals})
  end
`
    })
    .join("")
}
