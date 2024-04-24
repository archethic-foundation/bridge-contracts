import Archethic, { Utils } from "@archethicjs/sdk"
import config from "../../config.js"
import path from "path"
import fs from "fs"
import cliProgress from "cli-progress"

const command = "analytics"
const describe = "Analyze a pool chain"
const builder = {
  genesis_address: {
    describe: "The genesis address of a pool",
    demandOption: true, // Required
    type: "string"
  },
  save_path: {
    describe: "Path to save CSV file",
    demandOption: false,
    type: "string"
  },
  env: {
    describe: "The environment config to use (default to local)",
    demandOption: false,
    type: "string"
  }
}

const status = {
  0: "Didn't get provisionned",
  1: "Waiting for refund",
  2: "Waiting for withdraw",
  3: "Withdrawn",
  4: "Refunded",
  5: "Error on last transfer"
}

const protocolFeeAddress = "0000749D250560BF06C079832E0E9A24509B1E440A45C33BD9448B41B6A056FC6201"
const burnAddress = "00000000000000000000000000000000000000000000000000000000000000000000"

const handler = async function(argv) {
  const envName = argv["env"] ? argv["env"] : "local"
  const env = config.environments[envName]

  const poolGenesisAddress = argv["genesis_address"].toUpperCase()
  const savePath = argv["save_path"]

  const archethic = new Archethic(env.endpoint)
  await archethic.connect()

  const fundsCalls = []
  const secretHashCalls = []
  const setSecretHashCalls = []
  const revealSecretCalls = []
  const failedCall = []

  const nbChainTxs = await archethic.transaction.getTransactionIndex(poolGenesisAddress)

  let txsProcessed = 0
  let nextPagingAddress = undefined

  console.log("Fetching pool's transactions and split calls ...")

  const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
  progress.start(nbChainTxs, 0)

  do {
    progress.update(txsProcessed)

    // Fetch pool chain (batch of 10 txs), retrieve each transaction's inputs
    // filter call inputs and retrieve call details
    const res = await nextPage(archethic, poolGenesisAddress, nextPagingAddress)

    fundsCalls.push(...res.fundsCalls)
    secretHashCalls.push(...res.secretHashCalls)
    setSecretHashCalls.push(...res.setSecretHashCalls)
    revealSecretCalls.push(...res.revealSecretCalls)
    failedCall.push(...res.failedCall)

    txsProcessed += res.txsProcessed
    nextPagingAddress = txsProcessed < nbChainTxs ? res.nextPagingAddress : null
  } while (nextPagingAddress)

  progress.update(txsProcessed)
  progress.stop()

  console.log("==========")
  console.log("Analyze charged HTLCs ...")
  const chargedHTLCs = await getChargedHTLCs(archethic, fundsCalls, poolGenesisAddress)
  console.log("==========")
  console.log("Analyze Signed HTLCs ...")
  const signedHTLCs = await getSignedHTLCs(archethic, secretHashCalls, setSecretHashCalls, revealSecretCalls, poolGenesisAddress)

  console.log("\n==========\n")
  console.log("Charged HTLC stats")
  console.log("----------")
  logHTLCsStats(chargedHTLCs)
  console.log("\n==========\n")
  console.log("Signed HTLC stats")
  console.log("----------")
  logHTLCsStats(signedHTLCs)

  if (savePath) {
    console.log("==========")
    createChargedHTLCSsFile(chargedHTLCs, signedHTLCs, savePath)
  }
}

async function nextPage(archethic, poolGenesisAddress, pagingAddress) {
  let query = poolChainQuery(poolGenesisAddress, pagingAddress)
  const { transactionChain: poolTxs } = await archethic.network.rawGraphQLQuery(query)

  const failedCall = []
  const setSecretHashCalls = []

  const callQueries = poolTxs.reduce((acc, poolTx) => {
    const calls = filterAndSortInputCalls(poolTx.inputs)
    let call

    if (calls.length > 1) {
      [call] = calls.splice(-1)
      failedCall.push(...calls)
    } else {
      call = calls[0]
    }

    const recipients = poolTx.data.actionRecipients
    if (recipients.length > 0 && recipients[0].action == "set_secret_hash") {
      setSecretHashCalls.push(poolTx)
    }

    return call ? acc + "\n" + callQuery(poolTx.address, call.from) : acc
  }, "")

  query = `query {
    ${callQueries}
  }`

  const callTxs = await archethic.network.rawGraphQLQuery(query)

  const { fundsCalls, secretHashCalls, revealSecretCalls } = splitCallTxs(callTxs)

  const [{ address: nextPagingAddress }] = poolTxs.slice(-1)

  return {
    fundsCalls,
    secretHashCalls,
    setSecretHashCalls,
    revealSecretCalls,
    failedCall,
    nextPagingAddress,
    txsProcessed: poolTxs.length
  }
}

function poolChainQuery(poolGenesisAddress, pagingAddress) {
  if (pagingAddress) {
    return `query {
      transactionChain(
        address: "${poolGenesisAddress}",
        pagingAddress: "${pagingAddress}"
      ) {
		    address
        inputs {
          type, from, timestamp
        }
        data {
          actionRecipients {
            address, action, args
          }
        }
      }
    }`
  } else {
    return `query {
      transactionChain(
        address: "${poolGenesisAddress}"
      ) {
		    address
        inputs {
          type, from, timestamp
        }
        data {
          actionRecipients {
            address, action, args
          }
        }
      }
    }`
  }
}

function callQuery(address, callAddress) {
  return `X${address}: transaction(address: "${callAddress}") {
    address
    data {
      actionRecipients {
        action, args
      }
    }
    validationStamp {
      timestamp
      ledgerOperations {
        transactionMovements {
          to
        }
      }
    }
  }`
}

function filterAndSortInputCalls(inputs) {
  return inputs
    .filter(input => input.type == "call")
    .sort((a, b) => a.timestamp > b.timestamp ? 1 : -1)
}

function splitCallTxs(callTxs) {
  const fundsCalls = []
  const secretHashCalls = []
  const revealSecretCalls = []

  Object.values(callTxs).forEach(call => {
    call.data.actionRecipients.forEach(recipient => {
      switch (recipient.action) {
        case "request_funds":
          fundsCalls.push(call)
          break

        case "request_secret_hash":
          secretHashCalls.push(call)
          break

        case "reveal_secret":
          revealSecretCalls.push(call)
          break

        default:
          break
      }
    })
  })

  return { fundsCalls, secretHashCalls, revealSecretCalls }
}

async function getChargedHTLCs(archethic, fundsCallss, poolGenesisAddress) {
  const chargedHTLCs = []

  const addresses = fundsCallss.map(call => call.address)
  const htlcsChain = await getHTLCsChain(archethic, addresses)

  fundsCallss.forEach(call => {
    const htlcChain = htlcsChain[call.address]

    const endTime = call.data.actionRecipients[0].args[0]
    const userAddress = call.data.actionRecipients[0].args[2]

    const withdrawAddresses = [userAddress.toUpperCase()]
    const refundAddresses = [burnAddress, poolGenesisAddress]
    const { fee, userAmount, refundAmount, htlcStatus } = getHTLCDatas(htlcChain, endTime, withdrawAddresses, refundAddresses)

    const htlc = {
      creationAddress: call.address,
      creationTime: call.validationStamp.timestamp,
      amount: Utils.toBigInt(call.data.actionRecipients[0].args[1]),
      evmContract: call.data.actionRecipients[0].args[5],
      evmChainID: call.data.actionRecipients[0].args[6],
      endTime,
      userAddress,
      fee,
      userAmount,
      refundAmount,
      htlcStatus
    }

    chargedHTLCs.push(htlc)
  });

  return chargedHTLCs.sort((a, b) => a.creationTime > b.creationTime ? 1 : -1)
}

async function getHTLCsChain(archethic, addresses) {
  const htlcsChain = {}
  let addressesProcessed = 0

  const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
  progress.start(addresses.length, 0)

  const chunkSize = 10
  for (let i = 0; i < addresses.length; i += chunkSize) {
    progress.update(addressesProcessed)

    const chunk = addresses.slice(i, i + chunkSize)

    const query = getHtlcChainQueries(chunk)
    const res = await archethic.network.rawGraphQLQuery(query)

    chunk.forEach(address => {
      const id = "X" + address
      const htlcChain = res[id]

      htlcsChain[address] = htlcChain
    });

    addressesProcessed += chunk.length
  }

  progress.update(addressesProcessed)
  progress.stop()

  return htlcsChain
}

function getHtlcChainQueries(addresses) {
  const chainQueries = addresses.reduce((acc, address) => {
    return acc + "\n" + getHtlcChainQuery(address)
  }, "")

  return `query {
      ${chainQueries}
    }`
}

function getHtlcChainQuery(address) {
  return `X${address}: transactionChain(
    address: "${address}",
    pagingAddress: "${address}"
  ) {
		address
    data {
      ledger {
        token{
          transfers {
            to, amount
          }
        }
        uco {
          transfers {
            to, amount
          }
        }
      }
    }
    validationStamp {
      timestamp
    }
  }`
}

function getHTLCDatas(htlcChain, endTime, withdrawAddresses, refundsAddresses) {
  const now = Date.now() / 1000
  let htlcStatus = 0, fee = 0, userAmount = 0, refundAmount = 0

  const minAmountForFee = Utils.toBigInt(1e-8 / 0.003)

  if (htlcChain.length == 1 && endTime <= now) {
    htlcStatus = 1
  } else if (htlcChain.length == 1 && endTime > now) {
    htlcStatus = 2
  } else if (htlcChain.length >= 2) {
    const lastTransaction = htlcChain[1]
    const transfers = lastTransaction.data.ledger.uco.transfers.concat(lastTransaction.data.ledger.token.transfers)

    const feeTransfer = transfers.find(({ to }) => to == protocolFeeAddress)
    const userTransfer = transfers.find(({ to }) => withdrawAddresses.includes(to))
    const refundTransfer = transfers.find(({ to }) => refundsAddresses.includes(to))

    if (refundTransfer && !feeTransfer && !userTransfer) {
      refundAmount = refundTransfer.amount
      htlcStatus = 4
    } else if (refundTransfer && (feeTransfer || userTransfer)) {
      htlcStatus = 5
    } else if (userTransfer && feeTransfer) {
      fee = feeTransfer.amount
      userAmount = userTransfer.amount
      htlcStatus = 3
    } else if (userTransfer && userTransfer.amount < minAmountForFee) {
      userAmount = userTransfer.amount
      htlcStatus = 3
    } else {
      htlcStatus = 5
    }
  }

  return { fee, userAmount, refundAmount, htlcStatus }
}

async function getSignedHTLCs(archethic, secretHashCalls, setSecretHashCalls, revealSecretCalls, poolGenesisAddress) {
  // htlcGenesisAddress, amount, userAddress, chainId
  const signedHTLCs = []

  const addresses = secretHashCalls.map(call => call.validationStamp.ledgerOperations.transactionMovements[0].to)
  const htlcsChain = await getHTLCsChain(archethic, addresses)

  secretHashCalls.forEach(call => {
    const creationAddress = call.validationStamp.ledgerOperations.transactionMovements[0].to

    const genesisAddress = call.data.actionRecipients[0].args[0].toUpperCase()
    const setSecretHashCall = setSecretHashCalls.find(setCall => setCall.data.actionRecipients[0].address == genesisAddress)
    const revealSecretCall = revealSecretCalls.find(revealCall => revealCall.data.actionRecipients[0].args[0].toUpperCase() == genesisAddress)

    const endTime = setSecretHashCall ? setSecretHashCall.data.actionRecipients[0].args[2] : undefined
    const evmContract = revealSecretCall ? revealSecretCall.data.actionRecipients[0].args[2] : undefined
    const userAddress = call.data.actionRecipients[0].args[2]

    const htlcChain = htlcsChain[creationAddress]

    const withdrawAddresses = [burnAddress, poolGenesisAddress]
    const refundAddresses = [userAddress.toUpperCase()]
    const { fee, userAmount, refundAmount, htlcStatus } = getHTLCDatas(htlcChain, endTime, withdrawAddresses, refundAddresses)

    const htlc = {
      creationTime: call.validationStamp.timestamp,
      amount: Utils.toBigInt(call.data.actionRecipients[0].args[1]),
      evmChainID: call.data.actionRecipients[0].args[3],
      creationAddress,
      evmContract,
      endTime,
      userAddress,
      fee,
      userAmount,
      refundAmount,
      htlcStatus
    }

    signedHTLCs.push(htlc)
  });

  return signedHTLCs.sort((a, b) => a.creationTime > b.creationTime ? 1 : -1)
}

function logHTLCsStats(htlcs) {
  const {
    nbHTLC,
    nbInvalidHTLC,
    nbWithdrawnHTLC,
    nbRefundedHTLC,
    nbCurrentHTLC,
    nbNonRefundedHTLC,
    totalAmount,
    totalWithdrawnAmount,
    totalRefundedAmount,
    totalCurrentAmount,
    totalNonRefundedAmount,
    totalFeeAmount,
    totalInvalidHTLCAmount
  } = getHTLCsStats(htlcs)

  console.log("nbHTLC", nbHTLC)
  console.log("totalAmount", formatFloat(totalAmount))
  console.log("----------")
  console.log("nbWithdrawnHTLC", nbWithdrawnHTLC)
  console.log("totalWithdrawnAmount", formatFloat(totalWithdrawnAmount))
  console.log("totalFeeAmount", formatFloat(totalFeeAmount))
  console.log("----------")
  console.log("nbRefundedHTLC", nbRefundedHTLC)
  console.log("totalRefundedAmount", formatFloat(totalRefundedAmount))
  console.log("----------")
  console.log("nbNonRefundedHTLC", nbNonRefundedHTLC)
  console.log("totalNonRefundedAmount", formatFloat(totalNonRefundedAmount))
  console.log("----------")
  console.log("nbCurrentHTLC", nbCurrentHTLC)
  console.log("totalCurrentAmount", formatFloat(totalCurrentAmount))
  console.log("----------")
  console.log("nbInvalidHTLC", nbInvalidHTLC)
  console.log("totalInvalidHTLCAmount", formatFloat(totalInvalidHTLCAmount))
}

function getHTLCsStats(htlcs) {
  const init = {
    nbHTLC: htlcs.length,
    nbInvalidHTLC: 0,
    nbWithdrawnHTLC: 0,
    nbRefundedHTLC: 0,
    nbCurrentHTLC: 0,
    nbNonRefundedHTLC: 0,
    totalAmount: 0,
    totalWithdrawnAmount: 0,
    totalRefundedAmount: 0,
    totalCurrentAmount: 0,
    totalNonRefundedAmount: 0,
    totalFeeAmount: 0,
    totalInvalidHTLCAmount: 0
  }

  return htlcs.reduce((acc, htlc) => {
    acc.totalAmount += htlc.amount

    switch (htlc.htlcStatus) {
      case 0:
        acc.nbInvalidHTLC++
        acc.totalInvalidHTLCAmount += htlc.amount
        break

      case 1:
        acc.nbNonRefundedHTLC++
        acc.totalNonRefundedAmount += htlc.amount
        break

      case 2:
        acc.nbCurrentHTLC++
        acc.totalCurrentAmount += htlc.amount
        break

      case 3:
        acc.nbWithdrawnHTLC++
        acc.totalWithdrawnAmount += htlc.userAmount
        acc.totalFeeAmount += htlc.fee
        break

      case 4:
        acc.nbRefundedHTLC++
        acc.totalRefundedAmount += htlc.refundAmount
        break

      case 5:
        acc.nbInvalidHTLC++
        acc.totalInvalidHTLCAmount += htlc.amount
        break
    }

    return acc
  }, init)
}

function formatFloat(float) {
  return parseFloat(Utils.fromBigInt(float).toFixed(8))
}

function createChargedHTLCSsFile(chargedHTLCs, signedHTLCs, savePath) {
  const header = "Creation address;Creation time;Amount;EVM Contract address;" +
    "EVM Chain ID;Lock time;User address;Fee;Amount withdrawn;Amount refunded;Status;Status libelle"

  "Charged HTLCs\n" + header
  let content = formatToCSV(chargedHTLCs, "Charged HTLCs\n" + header)
  content = formatToCSV(signedHTLCs, content + "\n\nSigned HTLCs\n" + header)

  const filename = path.normalize(savePath)
  console.log("Write data to", filename)
  fs.writeFileSync(filename, content)
}

function formatToCSV(htlcs, header) {
  return htlcs.reduce((acc, htlc) => {
    const values = [
      htlc.creationAddress,
      htlc.creationTime,
      formatFloat(htlc.amount),
      htlc.evmContract,
      htlc.evmChainID,
      htlc.endTime,
      htlc.userAddress,
      formatFloat(htlc.fee),
      formatFloat(htlc.userAmount),
      formatFloat(htlc.refundAmount),
      htlc.htlcStatus,
      status[htlc.htlcStatus]
    ].join(";")

    return acc + "\n" + values
  }, header)
}

export default {
  command,
  describe,
  builder,
  handler
}

