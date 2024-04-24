import Archethic, { Utils } from "@archethicjs/sdk"
import config from "../../config.js"
import {
  encryptSecret,
  getGenesisAddress,
  getPoolServiceName,
  getServiceGenesisAddress,
  getTokenAddress,
  sendTransactionWithFunding
} from "../utils.js"

const command = "deploy_chargeable_htlc"
const describe = "Deploy a chargeable HTLC to swap from EVM to Archethic"
const builder = {
  token: {
    describe: "The token to receive on Archethic",
    demandOption: true, // Required
    type: "string"
  },
  seed: {
    describe: "The seed to use for create the HTLC contract",
    demandOption: true,
    type: "string"
  },
  endtime: {
    describe: "The end time provided by the EVM contract",
    demandOption: true,
    type: "integer"
  },
  amount: {
    describe: "The amount to receive from the swap",
    demandOption: true,
    type: "float"
  },
  secret_hash: {
    describe: "The hash of the secret",
    demandOption: true,
    type: "string"
  },
  evm_tx_address: {
    describe: "The creation address of EVM HTLC",
    demandOption: true,
    type: "string"
  },
  evm_contract_address: {
    describe: "The EVM HTLC contract address",
    demandOption: true,
    type: "string"
  },
  access_seed: {
    describe: "the keychain access seed (default in env config)",
    demandOption: false,
    type: "string"
  },
  env: {
    describe: "The environment config to use (default to local)",
    demandOption: false,
    type: "string"
  }
}

const handler = async function(argv) {
  const envName = argv["env"] ? argv["env"] : "local"
  const env = config.environments[envName]

  const keychainAccessSeed = argv["access_seed"] ? argv["access_seed"] : env.keychainAccessSeed

  if (keychainAccessSeed == undefined) {
    console.log("Keychain access seed not defined")
    process.exit(1)
  }

  const archethic = new Archethic(env.endpoint)
  await archethic.connect()

  let keychain

  try {
    keychain = await archethic.account.getKeychain(keychainAccessSeed)
  } catch (err) {
    console.log(err)
    process.exit(1)
  }

  const token = argv["token"]
  const seed = argv["seed"]
  const endTime = argv["endtime"]
  const amount = argv["amount"]
  const secretHash = argv["secret_hash"]
  const evmTxAddress = argv["evm_tx_address"]
  const evmContractAddress = argv["evm_contract_address"]

  const poolServiceName = getPoolServiceName(token)
  const tokenAddress = getTokenAddress(keychain, token)

  const poolGenesisAddress = getServiceGenesisAddress(keychain, poolServiceName)
  const factoryGenesisAddress = getServiceGenesisAddress(keychain, "Factory")
  const userAddress = getGenesisAddress(env.userSeed)

  const params = [endTime, userAddress, poolGenesisAddress, secretHash, tokenAddress, amount]
  const htlcCode = await archethic.network.callFunction(factoryGenesisAddress, "get_chargeable_htlc", params)

  const storageNonce = await archethic.network.getStorageNoncePublicKey()
  const { encryptedSecret, authorizedKeys } = encryptSecret(seed, storageNonce)

  const htlcGenesisAddress = getGenesisAddress(seed)
  console.log("Chargeable HTLC genesis address:", htlcGenesisAddress)
  const index = await archethic.transaction.getTransactionIndex(htlcGenesisAddress)

  // Get faucet before sending transaction
  // await requestFaucet(env.endpoint, poolGenesisAddress)

  const tx = archethic.transaction.new()
    .setType("contract")
    .setCode(htlcCode)
    .addRecipient(poolGenesisAddress, "request_funds", [endTime, amount, userAddress, secretHash, evmTxAddress, evmContractAddress, 31337])
    .addOwnership(encryptedSecret, authorizedKeys)
    .build(seed, index)
    .originSign(Utils.originPrivateKey)

  sendTransactionWithFunding(tx, keychain, archethic, env.userSeed)
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

export default {
  command,
  describe,
  builder,
  handler
}
