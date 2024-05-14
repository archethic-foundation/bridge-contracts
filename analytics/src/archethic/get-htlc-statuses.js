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

  debug(
    `${poolGenesisAddress}: processing ${res.fundsCalls.length} chargeable HTLCs`,
  );

  const chargeableHTLCs = await getChargeableHTLCs(archethic, res.fundsCalls);

  debug(`${poolGenesisAddress}: done`);
  debug(
    `${poolGenesisAddress}: processing ${res.secretHashCalls.length} signed HTLCs`,
  );

  const signedHTLCs = await getSignedHTLCs(
    archethic,
    res.secretHashCalls,
    res.setSecretHashCalls,
    res.revealSecretCalls,
  );

  debug(`${poolGenesisAddress}: done`);

  const pendingHTLCs = await getPendingHTLCs(db, poolGenesisAddress);
  debug(
    `${poolGenesisAddress}: processing ${pendingHTLCs.length} pending HTLCs`,
  );

  const updatedPendingHTLCs = await updatePendingHTLCs(archethic, pendingHTLCs);

  debug(`${poolGenesisAddress}: done`);

  await updateHtlcDb(db, poolGenesisAddress, [
    ...updatedPendingHTLCs,
    ...chargeableHTLCs,
    ...signedHTLCs,
  ]);
  await setPagingAddress(db, poolGenesisAddress, res.pagingAddress);

  return htlcStats(db, poolGenesisAddress);
}

async function getSignedHTLCs(
  archethic,
  secretHashCalls,
  setSecretHashCalls,
  revealSecretCalls,
) {
  // htlcGenesisAddress, amount, userAddress, chainId
  const signedHTLCs = [];

  const addresses = secretHashCalls.map(
    (call) => call.validationStamp.ledgerOperations.transactionMovements[0].to,
  );
  const htlcsChain = await getHTLCsChain(archethic, addresses);

  secretHashCalls.forEach((call) => {
    const creationAddress =
      call.validationStamp.ledgerOperations.transactionMovements[0].to;

    const genesisAddress = call.data.actionRecipients[0].args[0].toUpperCase();
    const setSecretHashCall = setSecretHashCalls.find(
      (setCall) =>
        setCall.data.actionRecipients[0].address.toUpperCase() ==
        genesisAddress,
    );
    const revealSecretCall = revealSecretCalls.find((revealCall) => {
      // there is 2 kinds of reveal secret transaction
      const chargeableMatch =
        revealCall.data.actionRecipients[0].args[0].toUpperCase() ==
        genesisAddress;

      const signedMatch =
        (revealCall.data.actionRecipients[0].address
          ? revealCall.data.actionRecipients[0].address.toUpperCase()
          : null) == genesisAddress;

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
    const userAddress = call.data.actionRecipients[0].args[2];

    const { fee, userAmount, refundAmount, status } = getHTLCDatas(
      htlcsChain[creationAddress],
    );

    const htlc = {
      type: "signed",
      creationTime: call.validationStamp.timestamp,
      amount: Utils.toBigInt(call.data.actionRecipients[0].args[1]),
      evmChainID: call.data.actionRecipients[0].args[3],
      secretHash,
      creationAddress,
      evmContract,
      endTime,
      userAddress,
      fee,
      userAmount,
      refundAmount,
      status,
    };

    signedHTLCs.push(htlc);
  });

  return signedHTLCs.sort((a, b) => (a.creationTime > b.creationTime ? 1 : -1));
}

async function getChargeableHTLCs(archethic, fundsCalls) {
  const chargedHTLCs = [];

  const addresses = fundsCalls.map((call) => call.address);
  const htlcsChain = await getHTLCsChain(archethic, addresses);

  fundsCalls.forEach((call) => {
    const htlcChain = htlcsChain[call.address];
    const endTime = call.data.actionRecipients[0].args[0];
    const userAddress = call.data.actionRecipients[0].args[2];
    const { fee, userAmount, refundAmount, status } = getHTLCDatas(htlcChain);

    const htlc = {
      type: "chargeable",
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
      status,
    };

    chargedHTLCs.push(htlc);
  });

  return chargedHTLCs.sort((a, b) =>
    a.creationTime > b.creationTime ? 1 : -1,
  );
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
  if (!matches) throw new Error("Could not extract the status from the info");

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

async function updatePendingHTLCs(archethic, pendingHTLCs) {
  const addresses = pendingHTLCs.map((htlc) => htlc.creationAddress);
  const htlcsChains = await getHTLCsChain(archethic, addresses);
  let updatedHTLCs = [];
  for (const [address, htlcChain] of Object.entries(htlcsChains)) {
    const { fee, userAmount, refundAmount, status } = getHTLCDatas(htlcChain);

    if (status != 0) {
      const htlc = pendingHTLCs.find((htlc) => htlc.creationAddress == address);
      htlc.fee = fee;
      htlc.userAmount = userAmount;
      htlc.refundAmount = refundAmount;
      htlc.status = status;
      updatedHTLCs.push(htlc);
    }
  }

  return updatedHTLCs;
}
