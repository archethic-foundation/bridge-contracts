import { Utils } from "@archethicjs/sdk";
import getPoolCalls from "./get-pool-calls.js";
import Debug from "debug";
import {
  updateHtlcDb,
  htlcStats,
  getPagingAddress,
  setPagingAddress,
} from "../registry/archethic-htlcs.js";

const debug = Debug("archethic:htlc");

export const HTLC_STATUS = {
  0: "NON_PROVISIONED",
  1: "WAIT_REFUND",
  2: "WAIT_WITHDRAW",
  3: "WITHDRAWN",
  4: "REFUNDED",
  5: "ERRORED",
};

const PROTOCOL_FEE_ADDRESS =
  "0000749D250560BF06C079832E0E9A24509B1E440A45C33BD9448B41B6A056FC6201";
const BURN_ADDRESS =
  "00000000000000000000000000000000000000000000000000000000000000000000";

export default async function (archethic, db, poolGenesisAddress) {
  const pagingAddress = await getPagingAddress(db, poolGenesisAddress);
  const res = await getPoolCalls(archethic, poolGenesisAddress, pagingAddress);

  debug(
    `${poolGenesisAddress}: processing ${res.fundsCalls.length} chargeable HTLCs`,
  );

  const chargeableHTLCs = await getChargeableHTLCs(
    archethic,
    res.fundsCalls,
    poolGenesisAddress,
  );

  debug(`${poolGenesisAddress}: done`);
  debug(
    `${poolGenesisAddress}: processing ${res.secretHashCalls.length} signed HTLCs`,
  );

  const signedHTLCs = await getSignedHTLCs(
    archethic,
    res.secretHashCalls,
    res.setSecretHashCalls,
    res.revealSecretCalls,
    poolGenesisAddress,
  );

  debug(`${poolGenesisAddress}: done`);

  await updateHtlcDb(db, poolGenesisAddress, [
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
  poolGenesisAddress,
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
    const revealSecretCall = revealSecretCalls.find(
      (revealCall) =>
        revealCall.data.actionRecipients[0].args[0].toUpperCase() ==
        genesisAddress,
    );

    const endTime = setSecretHashCall
      ? setSecretHashCall.data.actionRecipients[0].args[2]
      : undefined;
    const evmContract = revealSecretCall
      ? revealSecretCall.data.actionRecipients[0].args[2]
      : undefined;
    const userAddress = call.data.actionRecipients[0].args[2];

    const htlcChain = htlcsChain[creationAddress];

    const withdrawAddresses = [BURN_ADDRESS, poolGenesisAddress.toUpperCase()];
    const refundAddresses = [userAddress.toUpperCase()];
    const { fee, userAmount, refundAmount, htlcStatus } = getHTLCDatas(
      htlcChain,
      endTime,
      withdrawAddresses,
      refundAddresses,
    );

    const htlc = {
      type: "signed",
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
      htlcStatus,
    };

    signedHTLCs.push(htlc);
  });

  return signedHTLCs.sort((a, b) => (a.creationTime > b.creationTime ? 1 : -1));
}
async function getChargeableHTLCs(archethic, fundsCalls, poolGenesisAddress) {
  const chargedHTLCs = [];

  const addresses = fundsCalls.map((call) => call.address);
  const htlcsChain = await getHTLCsChain(archethic, addresses);

  fundsCalls.forEach((call) => {
    const htlcChain = htlcsChain[call.address];

    const endTime = call.data.actionRecipients[0].args[0];
    const userAddress = call.data.actionRecipients[0].args[2];

    const withdrawAddresses = [userAddress.toUpperCase()];
    const refundAddresses = [BURN_ADDRESS, poolGenesisAddress.toUpperCase()];
    const { fee, userAmount, refundAmount, htlcStatus } = getHTLCDatas(
      htlcChain,
      endTime,
      withdrawAddresses,
      refundAddresses,
    );

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
      htlcStatus,
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

function getHTLCDatas(htlcChain, endTime, withdrawAddresses, refundsAddresses) {
  const now = Date.now() / 1000;
  let htlcStatus = 0,
    fee = 0,
    userAmount = 0,
    refundAmount = 0;

  const minAmountForFee = Utils.toBigInt(1e-8 / 0.003);

  if (htlcChain.length == 1 && endTime <= now) {
    htlcStatus = 1;
  } else if (htlcChain.length == 1 && endTime > now) {
    htlcStatus = 2;
  } else if (htlcChain.length >= 2) {
    const lastTransaction = htlcChain[1];
    const transfers = lastTransaction.data.ledger.uco.transfers.concat(
      lastTransaction.data.ledger.token.transfers,
    );

    const feeTransfer = transfers.find(
      ({ to }) => to.toUpperCase() == PROTOCOL_FEE_ADDRESS,
    );
    const userTransfer = transfers.find(({ to }) =>
      withdrawAddresses.includes(to.toUpperCase()),
    );
    const refundTransfer = transfers.find(({ to }) =>
      refundsAddresses.includes(to.toUpperCase()),
    );

    if (refundTransfer && !feeTransfer && !userTransfer) {
      refundAmount = refundTransfer.amount;
      htlcStatus = 4;
    } else if (refundTransfer && (feeTransfer || userTransfer)) {
      htlcStatus = 5;
    } else if (userTransfer && feeTransfer) {
      fee = feeTransfer.amount;
      userAmount = userTransfer.amount;
      htlcStatus = 3;
    } else if (userTransfer && userTransfer.amount < minAmountForFee) {
      userAmount = userTransfer.amount;
      htlcStatus = 3;
    } else {
      htlcStatus = 5;
    }
  }

  return { fee, userAmount, refundAmount, htlcStatus };
}
