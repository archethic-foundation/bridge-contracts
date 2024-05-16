import { Utils } from "@archethicjs/sdk";
import getPoolCalls from "./get-pool-calls.js";
import Debug from "debug";
import {
  updateHtlcDb,
  htlcStats,
  getPagingAddress,
  setPagingAddress,
  getPendingHTLCs,
} from "../registry/archethic-htlcs.js";

const debug = Debug("archethic:htlc");

export const HTLC_STATUS = {
  0: "PENDING",
  1: "WITHDRAWN",
  2: "REFUNDED",
};

export default async function (archethic, db, poolGenesisAddress) {
  const pagingAddress = await getPagingAddress(db, poolGenesisAddress);
  const res = await getPoolCalls(archethic, poolGenesisAddress, pagingAddress);

  const chargeableHTLCs = await getChargeableHTLCs(
    archethic,
    db,
    poolGenesisAddress,
    res.fundsCalls,
  );

  const signedHTLCs = await getSignedHTLCs(
    archethic,
    db,
    poolGenesisAddress,
    res.secretHashCalls,
    res.setSecretHashCalls,
    res.revealSecretCalls,
  );

  await updateHtlcDb(db, poolGenesisAddress, [
    ...chargeableHTLCs,
    ...signedHTLCs,
  ]);
  await setPagingAddress(db, poolGenesisAddress, res.pagingAddress);

  return htlcStats(db, poolGenesisAddress);
}

async function getSignedHTLCs(
  archethic,
  db,
  poolGenesisAddress,
  secretHashCalls,
  setSecretHashCalls,
  revealSecretCalls,
) {
  const newSignedHTLCs = secretHashCalls.map((call) => {
    return {
      type: "signed",
      creationTime: call.validationStamp.timestamp,
      amount: Utils.toBigInt(call.data.actionRecipients[0].args[1]),
      evmChainID: call.data.actionRecipients[0].args[3],
      userAddress: call.data.actionRecipients[0].args[2],
      creationAddress:
        call.validationStamp.ledgerOperations.transactionMovements[0].to.toUpperCase(),
      genesisAddress: call.data.actionRecipients[0].args[0].toUpperCase(),
      status: 0,
    };
  });

  const pendingSignedHTLCs = await getPendingHTLCs(
    db,
    poolGenesisAddress,
    "signed",
  );

  const signedHTLCs = [...pendingSignedHTLCs, ...newSignedHTLCs];
  debug(`${poolGenesisAddress}/signed: processing ${signedHTLCs.length} HTLCs`);
  const htlcsChain = await getHTLCsChain(
    archethic,
    signedHTLCs.map((htlc) => htlc.creationAddress),
  );

  debug(`${poolGenesisAddress}/signed: done`);
  return signedHTLCs
    .map((htlc) => {
      return process_signed(
        htlc,
        htlcsChain,
        setSecretHashCalls,
        revealSecretCalls,
      );
    })
    .sort((a, b) => (a.creationTime > b.creationTime ? 1 : -1));
}

async function getChargeableHTLCs(
  archethic,
  db,
  poolGenesisAddress,
  fundsCalls,
) {
  const newChargeableHTLCs = fundsCalls.map((call) => {
    return {
      type: "chargeable",
      creationAddress: call.address,
      creationTime: call.validationStamp.timestamp,
      endTime: call.data.actionRecipients[0].args[0],
      amount: Utils.toBigInt(call.data.actionRecipients[0].args[1]),
      userAddress: call.data.actionRecipients[0].args[2],
      evmContract: call.data.actionRecipients[0].args[5],
      evmChainID: call.data.actionRecipients[0].args[6],
      status: 0,
    };
  });

  const pendingChargeableHTLCs = await getPendingHTLCs(
    db,
    poolGenesisAddress,
    "chargeable",
  );

  const chargeableHTLCs = [...pendingChargeableHTLCs, ...newChargeableHTLCs];
  debug(
    `${poolGenesisAddress}/chargeable: processing ${chargeableHTLCs.length} HTLCs`,
  );
  const htlcsChain = await getHTLCsChain(
    archethic,
    chargeableHTLCs.map((htlc) => htlc.creationAddress),
  );

  debug(`${poolGenesisAddress}/chargeable: done`);
  return chargeableHTLCs
    .map((htlc) => {
      return process_charged(htlc, htlcsChain);
    })
    .sort((a, b) => (a.creationTime > b.creationTime ? 1 : -1));
}

async function getHTLCsChain(archethic, addresses) {
  const htlcsChain = {};
  let addressesProcessed = 0;

  const chunkSize = 10;
  for (let i = 0; i < addresses.length; i += chunkSize) {
    const chunk = addresses.slice(i, i + chunkSize);

    const query = getHtlcChainQueries(chunk);
    const res = await archethic.network.rawGraphQLQuery(query);

    chunk.forEach((address) => {
      const id = "X" + address;
      const htlcChain = res[id];

      htlcsChain[address] = htlcChain;
    });

    debug(`+ ${Object.keys(res).length}`);

    addressesProcessed += chunk.length;
  }

  return htlcsChain;
}

function getHtlcChainQueries(addresses) {
  const chainQueries = addresses.reduce((acc, address) => {
    return acc + "\n" + getHtlcChainQuery(address);
  }, "");

  return `query {
      ${chainQueries}
    }`;
}

function getHtlcChainQuery(address) {
  return `X${address}: transactionChain(
    address: "${address}",
    pagingAddress: "${address}"
  ) {
		address
    data {
      code
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
  }`;
}

// I'm doing this instead of callFunction to do one less I/O
// and to keep the workflow synchronous
function infoFromTransaction(transaction) {
  // regex catch root level info code
  let matches = transaction.data.code.match(
    /^export fun info\(\) do[\s\S]*end/gm,
  );
  if (!matches) throw new Error("Could not extract the info from the code");

  // regex catch the status from the info code
  matches = matches[0].match(/status: (\d) #/);
  if (!matches)
    throw new Error(
      "Could not extract the status from the info: " + matches[0],
    );

  return { status: Number(matches[1]) };
}

function getHTLCDatas(htlcChain) {
  const lastTransaction = htlcChain[htlcChain.length - 1];
  let fee = 0,
    userAmount = 0,
    refundAmount = 0;

  const { status } = infoFromTransaction(lastTransaction);

  const transfers = lastTransaction.data.ledger.uco.transfers.concat(
    lastTransaction.data.ledger.token.transfers,
  );

  // status = refund
  if (transfers.length == 1 && status == 2) refundAmount = transfers[0].amount;

  // status = withdrawn without fees
  if (transfers.length == 1 && status == 1) userAmount = transfers[0].amount;

  // status = withdrawn with fees
  if (transfers.length == 2 && status == 1) {
    fee = transfers[0].amount;
    userAmount = transfers[1].amount;
  }

  return { fee, userAmount, refundAmount, status };
}

function process_signed(
  htlc,
  htlcsChain,
  setSecretHashCalls,
  revealSecretCalls,
) {
  const setSecretHashCall = setSecretHashCalls.find(
    (call) =>
      call.data.actionRecipients[0].address.toUpperCase() ==
      htlc.genesisAddress.toUpperCase(),
  );
  const revealSecretCall = revealSecretCalls.find((revealCall) => {
    // there is 2 kinds of reveal secret transaction
    const chargeableMatch =
      revealCall.data.actionRecipients[0].args[0].toUpperCase() ==
      htlc.genesisAddress.toUpperCase();

    const signedMatch = revealCall.data.actionRecipients[0].address
      ? revealCall.data.actionRecipients[0].address.toUpperCase() ==
        htlc.genesisAddress.toUpperCase()
      : false;

    return chargeableMatch || signedMatch;
  });

  const endTime = setSecretHashCall
    ? setSecretHashCall.data.actionRecipients[0].args[2]
    : undefined;
  const secretHash = setSecretHashCall
    ? "0x" + setSecretHashCall.data.actionRecipients[0].args[0]
    : undefined;
  const evmContract = revealSecretCall
    ? revealSecretCall.data.actionRecipients[0].args[2]
    : undefined;

  const { fee, userAmount, refundAmount, status } = getHTLCDatas(
    htlcsChain[htlc.creationAddress],
  );

  return {
    ...htlc,
    secretHash,
    evmContract,
    endTime,
    fee,
    userAmount,
    refundAmount,
    status,
  };
}

function process_charged(htlc, htlcsChain) {
  const { fee, userAmount, refundAmount, status } = getHTLCDatas(
    htlcsChain[htlc.creationAddress],
  );
  return {
    ...htlc,
    fee,
    userAmount,
    refundAmount,
    status,
  };
}
