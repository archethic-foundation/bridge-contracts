import Archethic, { Utils } from "@archethicjs/sdk"
import config from "../../config.js"
import {
  getServiceGenesisAddress,
} from "../utils.js"

import { getDeployTransaction } from "@archethicjs/multisig-sdk"

const command = "deploy_multisig"
const describe = "Deploy multisig for keychain master"
const builder = {
  initial_voter: {
    describe: "The initial voter address",
    demandOption: true, // Required
    type: "string"
  },
  access_seed: {
    describe: "The Keychain access seed (default in env config)",
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

  const initialVoter = argv["initial_voter"]

  const archethic = new Archethic(env.endpoint)
  await archethic.connect()

  let keychain

  try {
    keychain = await archethic.account.getKeychain(keychainAccessSeed)
  } catch (err) {
    console.log(err)
    process.exit(1)
  }

  const masterGenesisAddress = getServiceGenesisAddress(keychain, "Master")

  const storageNoncePublicKey = await archethic.network.getStorageNoncePublicKey();

  const res = keychain.ecEncryptServiceSeed("Master", [storageNoncePublicKey])
  const { secret, authorizedPublicKeys: authorizedKeys } = res
  console.log("Master genesis address:", masterGenesisAddress)
  const index = await archethic.transaction.getTransactionIndex(masterGenesisAddress)

  let updateTx = getDeployTransaction(archethic, {
    voters: [ initialVoter ],
    confirmationThreshold: 1,
  }, secret, authorizedKeys)

  updateTx = keychain.buildTransaction(updateTx, "Master", index).originSign(Utils.originPrivateKey)

  updateTx.on("fullConfirmation", async (_confirmations) => {
    const txAddress = Utils.uint8ArrayToHex(updateTx.address)
    console.log("Transaction validated !")
    console.log("Address:", txAddress)
    console.log(env.endpoint + "/explorer/transaction/" + txAddress)
    process.exit(0)
  }).on("error", (context, reason) => {
    console.log("Error while sending transaction")
    console.log("Contest:", context)
    console.log("Reason:", reason)
    process.exit(1)
  }).send()
}



export default {
  command,
  describe,
  builder,
  handler
}
