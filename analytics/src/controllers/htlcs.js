import config from "config";
import { ethers } from "ethers";
import HTLC_STATUS from "../statuses.js";
import registry from "../registry/index.js";

const ARCHETHIC_ENDPOINT = config.get("archethic.endpoint");
const EVM_NETWORKS = config.get("evm");

export default function () {
  return async (req, res) => {
    const htlcs = merge_chargeable(
      await registry.models.htlcAEChargeable.findAll(),
      await registry.models.htlcEVMChargeable.findAll(),
    ).concat(
      merge_signed(
        await registry.models.htlcAESigned.findAll(),
        await registry.models.htlcEVMSigned.findAll(),
      ),
    );

    res.render("htlcs", {
      HTLC_STATUS,
      htlcs,
      formatChainId,
      formatDate,
      formatArchethicAddr,
      formatArchethicAmount,
      formatEvmAddr,
      ARCHETHIC_ENDPOINT,
      ethers,
      poolToAsset,
      urlExplorerContract,
      urlExplorerUser,
    });
  };
}

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

function formatArchethicAddr(addr) {
  if (addr) {
    return addr.substr(4, 6) + "..." + addr.substr(-6);
  }
}

function formatEvmAddr(addr) {
  if (addr) {
    return addr.substr(0, 6) + "..." + addr.substr(-6);
  }
}

function formatChainId(chainID) {
  for (const [networkName, value] of Object.entries(EVM_NETWORKS)) {
    if (value.chainID == chainID) return networkName;
  }
}

function formatArchethicAmount(amount) {
  return ethers.formatUnits(amount + "", 8);
}

function urlExplorerContract(evmHtlc) {
  for (const [networkName, value] of Object.entries(EVM_NETWORKS)) {
    if (value.chainID == evmHtlc.chainId)
      return `${value.explorer}address/${evmHtlc.addressCreation}`;
  }
}

function urlExplorerUser(evmHtlc) {
  for (const [networkName, value] of Object.entries(EVM_NETWORKS)) {
    if (value.chainID == evmHtlc.chainId)
      return `${value.explorer}address/${evmHtlc.addressUser}`;
  }
}

function poolToAsset(blockchain, addressPool) {
  if (addressPool) {
    const poolsList =
      blockchain == "evm"
        ? Object.values(config.get("evm")).map((network) => network.pools)
        : [config.get("archethic").pools];

    for (const pools of poolsList) {
      for (const [asset, addressPool2] of Object.entries(pools)) {
        if (addressPool2.toUpperCase() == addressPool.toUpperCase())
          return asset;
      }
    }
  }
}

function merge_chargeable(archethicHtlcs, evmHtlcs) {
  let evmHtlcsToDiscard = [];
  for (const archethicHtlc of archethicHtlcs) {
    archethicHtlc.type = "chargeable";

    const match = evmHtlcs.find(
      (evmHtlc) =>
        evmHtlc.addressCreation.toLowerCase() ==
        archethicHtlc.evmContract.toLowerCase(),
    );
    if (match != null) {
      archethicHtlc.evmHtlc = match;
      evmHtlcsToDiscard.push(match.addressCreation);
    }
  }

  // evm HTLCs with no match in archethic
  for (const evmHtlc of evmHtlcs) {
    if (evmHtlcsToDiscard.includes(evmHtlc.addressCreation)) continue;

    archethicHtlcs.push({ type: "chargeable", evmHtlc: evmHtlc });
  }

  return archethicHtlcs;
}

function merge_signed(archethicHtlcs, evmHtlcs) {
  let evmHtlcsToDiscard = [];
  for (const archethicHtlc of archethicHtlcs) {
    archethicHtlc.type = "signed";

    const match = evmHtlcs.find(
      (evmHtlc) =>
        evmHtlc.secretHash.toLowerCase() ==
        archethicHtlc.secretHash.toLowerCase(),
    );
    if (match != null) {
      archethicHtlc.evmHtlc = match;
      evmHtlcsToDiscard.push(match.addressCreation);
    }
  }

  // evm HTLCs with no match in archethic
  for (const evmHtlc of evmHtlcs) {
    if (evmHtlcsToDiscard.includes(evmHtlc.addressCreation)) continue;

    archethicHtlcs.push({ type: "signed", evmHtlc: evmHtlc });
  }

  return archethicHtlcs;
}
