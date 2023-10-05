import fs from "fs"
import { Crypto, Utils } from "archethic"
import config from "../config.js"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ucoContractPath = path.resolve(__dirname, "../contracts/uco_pool.exs")
const tokenContractPath = path.resolve(__dirname, "../contracts/token_pool.exs")
const stateContractPath = path.resolve(__dirname, "../contracts/state_contract.exs")
const factoryContractPath = path.resolve(__dirname, "../contracts/factory.exs")

export function getGenesisAddress(seed) {
  return Utils.uint8ArrayToHex(Crypto.deriveAddress(seed, 0))
}

export function getTokenAddress(token) {
  if (token == "UCO") {
    return "UCO"
  } else {
    const { poolSeed } = getPoolInfo(token)
    return Utils.uint8ArrayToHex(Crypto.deriveAddress(poolSeed, 1))
  }
}

export function getPoolInfo(token) {
  const poolSeed = Crypto.hash(token).slice(1)
  const poolGenesisAddress = getGenesisAddress(poolSeed)

  return { poolSeed, poolGenesisAddress }
}

export function getStateInfo(token) {
  const stateSeed = Crypto.hash(token + "state").slice(1)
  const stateContractAddress = getGenesisAddress(stateSeed)

  return { stateSeed, stateContractAddress }
}

export function encryptSecret(secret, publicKey) {
  const aesKey = Crypto.randomSecretKey()
  const encryptedSecret = Crypto.aesEncrypt(secret, aesKey)
  const encryptedAesKey = Crypto.ecEncrypt(aesKey, publicKey)
  const authorizedKeys = [{ encryptedSecretKey: encryptedAesKey, publicKey: publicKey }]
  return { encryptedSecret, authorizedKeys }
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

export function getStateCode() {
  return fs.readFileSync(stateContractPath, "utf8")
}

export function getFactoryCode() {
  return fs.readFileSync(factoryContractPath, "utf8")
}

export function getPoolCode(env, token) {
  const { poolSeed, poolGenesisAddress } = getPoolInfo(token)
  const { stateContractAddress } = getStateInfo(token)

  return (token == "UCO") ?
    getUCOPoolCode(poolGenesisAddress, env) :
    getTokenPoolCode(poolSeed, poolGenesisAddress, stateContractAddress, env)
}

function getUCOPoolCode(poolGenesisAddress, env) {
  let poolCode = fs.readFileSync(ucoContractPath, "utf8")

  return replaceCommonTemplate(poolCode, poolGenesisAddress, env)
}

function getTokenPoolCode(poolSeed, poolGenesisAddress, stateContractAddress, env) {
  // First pool transaction create the token, so we calculate the token address as
  // the first transaction if the chain
  const tokenAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(poolSeed, 1))

  let poolCode = fs.readFileSync(tokenContractPath, "utf8")
  // Replace token address
  poolCode = poolCode.replaceAll("#TOKEN_ADDRESS#", "0x" + tokenAddress)
  // Replace state address
  poolCode = poolCode.replaceAll("#STATE_ADDRESS#", "0x" + stateContractAddress)

  return replaceCommonTemplate(poolCode, poolGenesisAddress, env)
}

function replaceCommonTemplate(poolCode, poolGenesisAddress, env) {
  // Replace genesis pool address
  poolCode = poolCode.replaceAll("#POOL_ADDRESS#", "0x" + poolGenesisAddress)
  // Replace factory address
  const factoryAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(env.factorySeed, 0))
  poolCode = poolCode.replaceAll("#FACTORY_ADDRESS#", "0x" + factoryAddress)
  // Replace master address
  const masterAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(env.masterSeed, 0))
  poolCode = poolCode.replaceAll("#MASTER_GENESIS_ADDRESS#", "0x" + masterAddress)
  // Replace available chain ids
  const chainIds = []
  for (let network of env.availableEvmNetworks) {
    const chainId = config.evmNetworks[network].chainId
    chainIds.push(chainId)
  }
  return poolCode.replaceAll("#CHAIN_IDS#", chainIds)
}
