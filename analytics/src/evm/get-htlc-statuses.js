import fs from "fs";
import { ethers } from "ethers";
import Debug from "debug";

const debug = Debug("evm:htlc");

const CHUNK_SIZE = 10;

const ERC_POOL = JSON.parse(
  fs.readFileSync("../evm/artifacts/contracts/Pool/ERCPool.sol/ERCPool.json"),
);
const NATIVE_POOL = JSON.parse(
  fs.readFileSync("../evm/artifacts/contracts/Pool/ETHPool.sol/ETHPool.json"),
);
const CHARGEABLE_NATIVE = JSON.parse(
  fs.readFileSync(
    "../evm/artifacts/contracts/HTLC/ChargeableHTLC_ETH.sol/ChargeableHTLC_ETH.json",
  ),
);
const CHARGEABLE_ERC = JSON.parse(
  fs.readFileSync(
    "../evm/artifacts/contracts/HTLC/ChargeableHTLC_ERC.sol/ChargeableHTLC_ERC.json",
  ),
);
const SIGNED_NATIVE = JSON.parse(
  fs.readFileSync(
    "../evm/artifacts/contracts/HTLC/SignedHTLC_ETH.sol/SignedHTLC_ETH.json",
  ),
);
const SIGNED_ERC = JSON.parse(
  fs.readFileSync(
    "../evm/artifacts/contracts/HTLC/SignedHTLC_ERC.sol/SignedHTLC_ERC.json",
  ),
);

export async function getHTLCStats(db, provider, poolAddress, htlcType) {
  let poolAbi;
  let htlcAbi;
  let contractFunction;

  switch (htlcType) {
    case "CHARGEABLE_NATIVE":
      poolAbi = NATIVE_POOL.abi;
      htlcAbi = CHARGEABLE_NATIVE.abi;
      contractFunction = "mintedSwaps";
      break;

    case "CHARGEABLE_UCO":
      poolAbi = ERC_POOL.abi;
      htlcAbi = CHARGEABLE_ERC.abi;
      contractFunction = "mintedSwaps";
      break;

    case "SIGNED_NATIVE":
      poolAbi = NATIVE_POOL.abi;
      htlcAbi = SIGNED_NATIVE.abi;
      contractFunction = "provisionedSwaps";
      break;

    case "SIGNED_UCO":
      poolAbi = ERC_POOL.abi;
      htlcAbi = SIGNED_ERC.abi;
      contractFunction = "provisionedSwaps";
      break;

    default:
      throw new Error("invalid HTLC TYPE");
  }

  const addressesToDiscard = await getAddressesToDiscard(
    db,
    poolAddress,
    htlcType,
  );
  const poolContract = new ethers.Contract(poolAddress, poolAbi, provider);
  const htlcsAddresses = await poolContract[contractFunction]();

  const htlcsAddressesToProcess = htlcsAddresses.filter(
    (address) => !addressesToDiscard.includes(address),
  );

  debug(`${htlcType}: processing ${htlcsAddressesToProcess.length} HTLCs`);
  const htlcs = await list(provider, htlcsAddressesToProcess, htlcAbi);
  await persistHTLCs(db, htlcs, poolAddress, htlcType);
  return stats(await getHTLCs(db, poolAddress));
}

async function list(provider, addresses, abi) {
  let swaps = [];
  for (let i = 0; i < addresses.length; i += CHUNK_SIZE) {
    const chunkAddresses = addresses.slice(i, i + CHUNK_SIZE);
    const chunkSwaps = await Promise.all(
      chunkAddresses.map(async (address) => {
        const htlcContract = new ethers.Contract(address, abi, provider);
        const [statusEnum, amount] = await Promise.all([
          htlcContract.status(),
          htlcContract.amount(),
        ]);

        return { address, status: statusFromEnum(statusEnum), amount };
      }),
    );

    swaps = swaps.concat(chunkSwaps);
    debug(`+ ${chunkSwaps.length}`);
  }
  return swaps;
}

function stats(htlcs) {
  let amountWithdrawn = 0n;
  let amountRefunded = 0n;
  let amountPending = 0n;
  let countPending = 0;
  let countWithdrawn = 0;
  let countRefunded = 0;

  htlcs.forEach(({ status, amount }) => {
    switch (status) {
      case "PENDING":
        countPending++;
        amountPending += amount;
        break;

      case "WITHDRAWN":
        countWithdrawn++;
        amountWithdrawn += amount;
        break;

      case "REFUNDED":
        countRefunded++;
        amountRefunded += amount;
        break;
    }
  });

  return {
    amountWithdrawn,
    amountRefunded,
    amountPending,
    countPending,
    countWithdrawn,
    countRefunded,
  };
}

async function getAddressesToDiscard(db, poolAddress, htlcType) {
  let addresses = [];
  try {
    addresses = await db.get(discardedAddressesKey(poolAddress, htlcType));
  } catch (_) {}
  return addresses;
}

async function persistHTLCs(db, htlcs, poolAddress, htlcType) {
  let newAddressesToDiscard = [];

  await Promise.all(
    htlcs.map(async ({ address, status, amount }) => {
      if (status != "PENDING") {
        newAddressesToDiscard.push(address);
      }

      await db.put(`${htlcNamespaceKey(poolAddress)}:${address}`, {
        status,
        amount: serializeAmount(amount),
      });
    }),
  );

  // FIXME: NOT ATOMIC
  const prevAddressesToDiscard = await getAddressesToDiscard(
    db,
    poolAddress,
    htlcType,
  );
  const toDiscard = [
    ...new Set([...prevAddressesToDiscard, ...newAddressesToDiscard]),
  ];
  await db.put(discardedAddressesKey(poolAddress, htlcType), toDiscard);
  // FIXME: NOT ATOMIC

  return;
}

async function getHTLCs(db, poolAddress) {
  let htlcs = [];

  for await (const [key, value] of db.iterator()) {
    if (key.startsWith(htlcNamespaceKey(poolAddress))) {
      const address = key.split(":").pop();
      htlcs.push({
        address,
        status: value.status,
        amount: deserializeAmount(value.amount),
      });
    }
  }
  return htlcs;
}

function discardedAddressesKey(poolAddress, htlcType) {
  return `htlc:evm:discard:${poolAddress}:${htlcType}`;
}

function htlcNamespaceKey(poolAddress) {
  return `htlc:evm:${poolAddress}`;
}

function serializeAmount(amount) {
  return amount + "";
}
function deserializeAmount(amount) {
  return BigInt(amount);
}

function statusFromEnum(s) {
  let status;
  switch (s) {
    case 0n:
      status = "PENDING";
      break;

    case 1n:
      status = "WITHDRAWN";
      break;

    case 2n:
      status = "REFUNDED";
      break;

    default:
      throw new Error(`unknown HTLC status: ${status}`);
  }
  return status;
}
