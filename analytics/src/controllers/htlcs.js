import { getHTLCs as getEVMHTLCs } from "../registry/evm-htlcs.js";
import { getHTLCs as getArchethicHtlcs } from "../registry/archethic-htlcs.js";
import { HTLC_STATUS } from "../archethic/get-htlc-statuses.js";
import config from "config";

const ARCHETHIC_ENDPOINT = config.get("archethic.endpoint");
const EVM_NETWORKS = config.get("evm");

export default function (db) {
  return async (req, res) => {
    const chargeableHTLCs = merge(
      await getArchethicHtlcs(db, "chargeable"),
      await getEVMHTLCs(db, "chargeable"),
      "chargeable",
    );

    const signedHTLCs = merge(
      await getArchethicHtlcs(db, "signed"),
      await getEVMHTLCs(db, "signed"),
      "signed",
    );

    const htlcs = [...chargeableHTLCs, ...signedHTLCs];

    const formatDate = (date) => {
      return (
        date.getUTCFullYear() +
        "-" +
        String(date.getUTCMonth() + 1).padStart(2, "0") +
        "-" +
        String(date.getUTCDate()).padStart(2, "0") +
        "T" +
        String(date.getUTCHours()).padStart(2, "0") +
        ":" +
        String(date.getUTCMinutes()).padStart(2, "0") +
        ":" +
        String(date.getUTCSeconds()).padStart(2, "0") +
        "Z"
      );
    };

    const formatArchethicAddr = (addr) =>
      addr.substr(4, 6) + "..." + addr.substr(-6);

    const formatEvmAddr = (addr) => addr.substr(0, 6) + "..." + addr.substr(-6);
    const formatChainId = (chainID) => {
      for (const [networkName, value] of Object.entries(EVM_NETWORKS)) {
        if (value.chainID == chainID) return networkName;
      }
    };

    res.render("htlcs", {
      HTLC_STATUS,
      htlcs,
      formatChainId,
      formatDate,
      formatArchethicAddr,
      formatEvmAddr,
      ARCHETHIC_ENDPOINT,
    });
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
