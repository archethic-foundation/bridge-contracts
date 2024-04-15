import { getChargeableHTLCs as getEVMChargeableHTLCs } from "../registry/evm-htlcs.js";
import { getChargeableHTLCs as getArchethicChargeableHTLCs } from "../registry/archethic-htlcs.js";
import { HTLC_STATUS } from "../archethic/get-htlc-statuses.js";
import config from "config";

const archethicEndpoint = config.get("archethic.endpoint");

export default function (db) {
  return async (req, res) => {
    const evmHtlcs = await getEVMChargeableHTLCs(db);
    const archethicHtlcs = await getArchethicChargeableHTLCs(db);

    const htlcs = merge(archethicHtlcs, evmHtlcs);

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

    res.render("chargeable", {
      HTLC_STATUS,
      htlcs,
      formatDate,
      formatArchethicAddr,
      formatEvmAddr,
      archethicEndpoint,
    });
  };
}

function merge(archethicHtlcs, evmHtlcs) {
  for (const archethicHtlc of archethicHtlcs) {
    if (archethicHtlc.evmContract) {
      const match = evmHtlcs.find(
        (evmHtlc) =>
          evmHtlc.address.toLowerCase() ==
          archethicHtlc.evmContract.toLowerCase(),
      );
      if (match != null) {
        archethicHtlc.evmHtlc = match;
      }
    }
  }
  return archethicHtlcs;
}
