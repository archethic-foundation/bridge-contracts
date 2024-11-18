import Archethic, { Utils } from "@archethicjs/sdk"
import config from "../../config.js"
import { getPoolCode, getServiceGenesisAddress, getPoolServiceName } from "../utils.js"
import { getProposeTransaction } from "@archethicjs/multisig-sdk"

const command = "update_pool"
const describe = "Update an existing pool"
const builder = {
  token: {
    describe: "The token of the pool to update, UCO or token symbol",
    demandOption: true, // Required
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
  },
  with_multisig: {
    describe: "Determine if we need to use the multisig for the update",
    demandOption: false,
    type: "boolean"
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

  const withMultisig = argv["with_multisig"] == false ? false : true

  const archethic = new Archethic(withMultisig ? undefined : env.endpoint)
  if (archethic.rpcWallet) {
    archethic.rpcWallet.setOrigin({ name: "Archethic Bridge CLI" });
  }
  await archethic.connect()

  let keychain

  try {
    keychain = await archethic.account.getKeychain(keychainAccessSeed)

    const token = argv["token"]
    const serviceName = getPoolServiceName(token)
    const poolGenesisAddress = getServiceGenesisAddress(keychain, serviceName)

    const indexPool = await archethic.transaction.getTransactionIndex(poolGenesisAddress)
    if (indexPool == 0) {
      console.log("Pool doesn't exists !")
      process.exit(1)
    }

    const poolCode = getPoolCode(envName, keychain, token)

    const masterGenesisAddress = getServiceGenesisAddress(keychain, "Master")
    console.log("Master genesis address:", masterGenesisAddress)
    const index = await archethic.transaction.getTransactionIndex(masterGenesisAddress)

    let updateTx
    if (withMultisig) {
      updateTx = getProposeTransaction(archethic, masterGenesisAddress, { recipients: [
        { 
          address: poolGenesisAddress,
          action: "update_code",
          args: [poolCode]
        }
      ] })

      const res = await archethic.network.rawGraphQLQuery(`
        query{
        chainUnspentOutputs(address: "${masterGenesisAddress}") {
          state
        }
      }`)
      const { state: oldState} = res.chainUnspentOutputs.find(x => x.state != null)
      const nextTxID = oldState.transaction_id + 1

      if(archethic.rpcWallet) {
        const { transactionAddress } = await archethic.rpcWallet.sendTransaction(updateTx)

        console.log("Transaction validated !")
        console.log("Address:", transactionAddress)
        console.log(env.endpoint + "/explorer/transaction/" + transactionAddress)
        console.log("Multisig Transaction ID", nextTxID)

        process.exit(0)
      }
    }
    else {
      updateTx = archethic.transaction.new()
        .setType("transfer")
        .addRecipient(poolGenesisAddress, "update_code", [poolCode])

      updateTx = keychain.buildTransaction(updateTx, "Master", index).originSign(Utils.originPrivateKey)
    }

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

  } catch (err) {
    console.log(err)
    process.exit(1)
  }
}

export default {
  command,
  describe,
  builder,
  handler
}
