import config from "config";
import Archethic, { Utils } from "@archethicjs/sdk";
import Debug from "debug";
import fs from "fs";

import getPoolCalls from "../archethic/get-pool-calls.js";
import registry from "../registry/index.js";
import HTLC_STATUS from "../statuses.js";

const debug = Debug("bridge:cron:ae:htlc");
const POOLS = config.get("archethic.pools");
const ENDPOINT = config.get("archethic.endpoint");

(async () => {
  debug("start");
  debug(`Connecting to endpoint ${ENDPOINT}...`);
  const archethic = new Archethic(ENDPOINT);
  await archethic.connect();
  debug(`Connected!`);

  for (const [asset, poolGenesisAddress] of Object.entries(POOLS)) {
    debug(`Pool ${poolGenesisAddress} (${asset})`);

    const maybePagingAddress = await registry.models.kv.findByPk(
      `paging-${poolGenesisAddress}`,
    );

    const res = await getPoolCalls(
      archethic,
      poolGenesisAddress,
      maybePagingAddress?.value,
    );

    await updateSigned(archethic, res, poolGenesisAddress);
    await updateChargeable(archethic, res, poolGenesisAddress);

    // update the paging address
    await registry.models.kv
      .findOrBuild({ where: { key: `paging-${poolGenesisAddress}` } })
      .then(([kv, init]) => kv.set({ value: res.pagingAddress }).save());
  }

  debug("done");
})();

async function updateSigned(archethic, res, poolGenesisAddress) {
  const pendingSignedHTLCs = await registry.models.htlcAESigned.findAll({
    where: {
      addressPool: poolGenesisAddress,
      status: "PENDING",
    },
  });

  const newSignedHTLCs = await Promise.all(
    res.secretHashCalls.map((call) => {
      return registry.models.htlcAESigned
        .findOrBuild({
          where: {
            addressCreation:
              call.validationStamp.ledgerOperations.transactionMovements[0].to.toUpperCase(),
          },
          defaults: {
            addressUser: call.data.actionRecipients[0].args[2],
            addressGenesis: call.data.actionRecipients[0].args[0].toUpperCase(),
            addressPool: poolGenesisAddress,

            amount: Utils.parseBigInt(call.data.actionRecipients[0].args[1].toFixed(8)),

            evmChainId: call.data.actionRecipients[0].args[3],
            status: "PENDING",
            timeCreation: call.validationStamp.timestamp,
          },
        })
        .then(([instance, init]) => instance);
    }),
  );

  const signedHTLCs = [...pendingSignedHTLCs, ...newSignedHTLCs];
  debug(`${poolGenesisAddress}/signed: processing ${signedHTLCs.length} HTLCs`);

  // fetch the chains
  const htlcsChain = await getHTLCsChain(
    archethic,
    signedHTLCs.map((htlc) => htlc.addressCreation),
  );

  debug(`${poolGenesisAddress}/signed: done`);

  // update the HTLC table
  await Promise.all(
    signedHTLCs
      .map((htlc) => {
        return process_signed(
          htlc,
          htlcsChain,
          res.setSecretHashCalls,
          res.revealSecretCalls,
        );
      })
      .map((htlc) => {
        return htlc.save();
      }),
  );
}

async function updateChargeable(archethic, res, poolGenesisAddress) {
  const pendingChargeableHTLCs = await registry.models.htlcAEChargeable.findAll(
    {
      where: {
        addressPool: poolGenesisAddress,
        status: "PENDING",
      },
    },
  );

  const newChargeableHTLCs = await Promise.all(
    res.fundsCalls.map((call) => {
      return registry.models.htlcAEChargeable
        .findOrBuild({
          where: {
            addressCreation: call.address,
          },
          defaults: {
            addressUser: call.data.actionRecipients[0].args[2],
            addressPool: poolGenesisAddress,

            evmContract: call.data.actionRecipients[0].args[5],
            evmChainId: call.data.actionRecipients[0].args[6],

            amount: Utils.parseBigInt(call.data.actionRecipients[0].args[1].toFixed(8)),

            status: "PENDING",
            timeCreation: call.validationStamp.timestamp,
            timeLockEnd: call.data.actionRecipients[0].args[0],
          },
        })
        .then(([instance, init]) => instance);
    }),
  );

  let chargeableHTLCs = [...pendingChargeableHTLCs, ...newChargeableHTLCs];
  debug(
    `${poolGenesisAddress}/chargeable: processing ${chargeableHTLCs.length} HTLCs`,
  );

  // fetch the chains
  const htlcsChain = await getHTLCsChain(
    archethic,
    chargeableHTLCs.map((htlc) => htlc.addressCreation),
  );

  debug(`${poolGenesisAddress}/chargeable: done`);

  // update the HTLC table
  await Promise.all(
    chargeableHTLCs
      .map((htlc) => {
        return process_charged(htlc, htlcsChain);
      })
      .map((htlc) => {
        return htlc.save();
      }),
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
  if (!matches)
    throw new Error(
      "Could not extract the status from the info: " + matches[0],
    );

  return { status: HTLC_STATUS[Number(matches[1])] };
}

function getHTLCDatas(htlcChain) {
  const lastTransaction = htlcChain[htlcChain.length - 1];
  let amountFee = 0,
    amountUser = 0,
    amountRefund = 0;

  const { status } = infoFromTransaction(lastTransaction);

  const transfers = lastTransaction.data.ledger.uco.transfers.concat(
    lastTransaction.data.ledger.token.transfers,
  );

  // status = refund
  if (transfers.length == 1 && status == "REFUND")
    amountRefund = transfers[0].amount;

  // status = withdrawn without fees
  if (transfers.length == 1 && status == "WITHDRAWN")
    amountUser = transfers[0].amount;

  // status = withdrawn with fees
  if (transfers.length == 2 && status == "WITHDRAWN") {
    amountFee = transfers[0].amount;
    amountUser = transfers[1].amount;
  }

  return { amountFee, amountUser, amountRefund, status };
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
      htlc.addressGenesis.toUpperCase(),
  );
  const revealSecretCall = revealSecretCalls.find((revealCall) => {
    // there is 2 kinds of reveal secret transaction
    const chargeableMatch =
      revealCall.data.actionRecipients[0].args[0].toUpperCase() ==
      htlc.addressGenesis.toUpperCase();

    const signedMatch = revealCall.data.actionRecipients[0].address
      ? revealCall.data.actionRecipients[0].address.toUpperCase() ==
      htlc.addressGenesis.toUpperCase()
      : false;

    return chargeableMatch || signedMatch;
  });

  const timeLockEnd = setSecretHashCall
    ? setSecretHashCall.data.actionRecipients[0].args[2]
    : undefined;
  const secretHash = setSecretHashCall
    ? "0x" + setSecretHashCall.data.actionRecipients[0].args[0]
    : undefined;
  const evmContract = revealSecretCall
    ? revealSecretCall.data.actionRecipients[0].args[2]
    : undefined;

  return htlc
    .set({
      secretHash,
      evmContract,
      timeLockEnd,
    })
    .set(getHTLCDatas(htlcsChain[htlc.addressCreation]));
}

function process_charged(htlc, htlcsChain) {
  return htlc.set(getHTLCDatas(htlcsChain[htlc.addressCreation]));
}
