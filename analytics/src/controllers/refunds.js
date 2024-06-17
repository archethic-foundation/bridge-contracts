import { getHTLCs as getEVMHTLCs } from "../registry/evm-htlcs.js";
import { getHTLCs as getArchethicHtlcs } from "../registry/archethic-htlcs.js";
import { HTLC_STATUS } from "../archethic/get-htlc-statuses.js";
import config from "config";

const ARCHETHIC_ENDPOINT = config.get("archethic.endpoint");
const EVM_NETWORKS = config.get("evm");

export default function (db) {
  return async (req, res) => {
    const chargeableHTLCs = filterRefund(merge(
      await getArchethicHtlcs(db, "chargeable"),
      await getEVMHTLCs(db, "chargeable"),
      "chargeable",
    ));

    const signedHTLCs = filterRefund(merge(
      await getArchethicHtlcs(db, "signed"),
      await getEVMHTLCs(db, "signed"),
      "signed",
    ));

    const htlcs = [...chargeableHTLCs, ...signedHTLCs];

    res.json(htlcs.map((htlc) => {
      if (htlc.type == "chargeable") {
        return { archethicAddress: htlc.address, evmAddress: htlc.evmHtlc.address, evmChain: htlc.evmHtlc.chain, claimingAmount: htlc.amount / 100_000_000, type: htlc.type, claimingAsset: htlc.asset }
      }
      else {
        return { archethicAddress: htlc.address, evmAddress: htlc.evmHtlc.address, evmChain: htlc.evmHtlc.chain, claimingAmount: htlc.evmHtlc.amount, type: htlc.type, claimingAsset: htlc.evmHtlc.asset }
      }
    }));
  };
}

function merge(archethicHtlcs, evmHtlcs, type) {
  // dump mumbai
  archethicHtlcs = archethicHtlcs.filter((htlc) => htlc.evmChainID != 80001);

  let evmHtlcsToDiscard = [];

  // match HTLCs (best effort)
  for (const archethicHtlc of archethicHtlcs) {
    archethicHtlc.type = type;
    if (archethicHtlc.evmContract) {
      const match = evmHtlcs.find(
        (evmHtlc) =>
          evmHtlc.address.toLowerCase() ==
          archethicHtlc.evmContract.toLowerCase(),
      );
      if (match != null) {
        archethicHtlc.evmHtlc = match;
        evmHtlcsToDiscard.push(archethicHtlc.evmHtlc.address);
      }
    } else {
      // try to match based on the secrethash
      if (archethicHtlc.secretHash) {
        const match = evmHtlcs.find((evmHtlc) => {
          // secrethash is not set on chargeable
          if (evmHtlc.secretHash) {
            console.log(
              evmHtlc.secretHash.toLowerCase(),
              archethicHtlc.secretHash.toLowerCase(),
            );
            return (
              evmHtlc.secretHash.toLowerCase() ==
              archethicHtlc.secretHash.toLowerCase()
            );
          } else {
            return false;
          }
        });
        if (match != null) {
          archethicHtlc.evmHtlc = match;
          evmHtlcsToDiscard.push(archethicHtlc.evmHtlc.address);
        }
      }
    }
  }

  // evm HTLCs with no match in archethic
  for (const evmHtlc of evmHtlcs) {
    if (evmHtlcsToDiscard.includes(evmHtlc.address)) continue;

    archethicHtlcs.push({ evmHtlc: evmHtlc });
  }
  return archethicHtlcs;
}

function filterRefund(htlcs) {
  return htlcs.filter((htlc) => {
    if (!htlc.evmHtlc || !htlc.creationTime) {
      return false
    }

    return (htlc.evmHtlc.status == "REFUNDED" && htlc.status != 2) || (htlc.status == 2 && htlc.evmHtlc.status != "REFUNDED")
  })
}
