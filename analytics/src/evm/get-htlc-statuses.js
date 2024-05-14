import fs from "fs";
import { ethers } from "ethers";
import Debug from "debug";
import {
  getAddressesToDiscard,
  getHTLCs,
  persistHTLCs,
} from "../registry/evm-htlcs.js";

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

export async function getHTLCStats(db, provider, poolAddress, htlcType, asset) {
  let poolAbi;
  let htlcAbi;
  let contractFunction;

  switch (htlcType) {
    case "chargeable":
      htlcAbi = asset == "NATIVE" ? CHARGEABLE_NATIVE.abi : CHARGEABLE_ERC.abi;
      poolAbi = asset == "NATIVE" ? NATIVE_POOL.abi : ERC_POOL.abi;
      contractFunction = "mintedSwaps";
      break;

    case "signed":
      htlcAbi = asset == "NATIVE" ? SIGNED_NATIVE.abi : SIGNED_ERC.abi;
      poolAbi = asset == "NATIVE" ? NATIVE_POOL.abi : ERC_POOL.abi;
      contractFunction = "provisionedSwaps";
      break;

    default:
      throw new Error("invalid HTLC TYPE");
  }

  const addressesToDiscard = await getAddressesToDiscard(
    db,
    poolAddress,
    htlcType,
    asset,
  );
  const poolContract = new ethers.Contract(poolAddress, poolAbi, provider);
  const htlcsAddresses = await poolContract[contractFunction]();

  const htlcsAddressesToProcess = htlcsAddresses.filter(
    (address) => !addressesToDiscard.includes(address),
  );

  debug(
    `${htlcType}/${asset}: processing ${htlcsAddressesToProcess.length} HTLCs`,
  );
  const htlcs = await list(provider, htlcsAddressesToProcess, htlcAbi);
  await persistHTLCs(db, htlcs, poolAddress, htlcType, asset);
  return stats(await getHTLCs(db, htlcType, asset, poolAddress));
}

async function list(provider, addresses, abi) {
  let swaps = [];
  for (let i = 0; i < addresses.length; i += CHUNK_SIZE) {
    const chunkAddresses = addresses.slice(i, i + CHUNK_SIZE);
    const chunkSwaps = await Promise.all(
      chunkAddresses.map(async (address) => {
        const htlcContract = new ethers.Contract(address, abi, provider);
        const [statusEnum, amount, lockTime, userAddress, secretHash] =
          await Promise.all([
            htlcContract.status(),
            htlcContract.amount(),
            htlcContract.lockTime(),
            htlcContract.from(),
            htlcContract.hash(),
          ]);

        return {
          secretHash,
          address,
          status: statusFromEnum(statusEnum),
          amount,
          lockTime,
          userAddress,
        };
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
