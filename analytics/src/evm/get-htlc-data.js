import fs from "fs";
import { ethers } from "ethers";
import Debug from "debug";

const debug = Debug("bridge:cron:evm:htlc:calls");

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

export async function getHTLCData(
  provider,
  poolAddress,
  htlcType,
  asset,
  addressesToDiscard,
  chainId,
) {
  let poolAbi;
  let htlcAbi;
  let contractFunction;
  let userAddressVariable;

  switch (htlcType) {
    case "CHARGEABLE":
      htlcAbi = asset == "NATIVE" ? CHARGEABLE_NATIVE.abi : CHARGEABLE_ERC.abi;
      poolAbi = asset == "NATIVE" ? NATIVE_POOL.abi : ERC_POOL.abi;
      contractFunction = "mintedSwaps";
      userAddressVariable = "from";
      break;

    case "SIGNED":
      htlcAbi = asset == "NATIVE" ? SIGNED_NATIVE.abi : SIGNED_ERC.abi;
      poolAbi = asset == "NATIVE" ? NATIVE_POOL.abi : ERC_POOL.abi;
      contractFunction = "provisionedSwaps";
      userAddressVariable = "recipient";
      break;

    default:
      throw new Error("invalid HTLC TYPE");
  }

  const poolContract = new ethers.Contract(poolAddress, poolAbi, provider);
  const htlcsAddresses = await poolContract[contractFunction]();

  const htlcsAddressesToProcess = htlcsAddresses.filter(
    (address) => !addressesToDiscard.includes(address),
  );
  debug(
    `${htlcType}/${asset}: discarded ${htlcsAddresses.length - htlcsAddressesToProcess.length} HTLCs`,
  );
  debug(
    `${htlcType}/${asset}: processing ${htlcsAddressesToProcess.length} HTLCs`,
  );
  return list(
    provider,
    htlcsAddressesToProcess,
    htlcAbi,
    userAddressVariable,
    poolAddress,
    chainId,
  );
}

async function list(
  provider,
  addresses,
  abi,
  userAddressVariable,
  addressPool,
  chainId,
) {
  let swaps = [];
  for (let i = 0; i < addresses.length; i += CHUNK_SIZE) {
    const chunkAddresses = addresses.slice(i, i + CHUNK_SIZE);
    const chunkSwaps = await Promise.all(
      chunkAddresses.map(async (addressCreation) => {
        const htlcContract = new ethers.Contract(
          addressCreation,
          abi,
          provider,
        );
        const [statusEnum, amount, timeLockEnd, addressUser, secretHash] =
          await Promise.all([
            htlcContract.status(),
            htlcContract.amount(),
            htlcContract.lockTime(),
            htlcContract[userAddressVariable](),
            htlcContract.hash(),
          ]);

        return {
          addressCreation,
          addressUser,
          addressPool,
          chainId,
          amount,
          status: statusFromEnum(statusEnum),
          secretHash,
          timeLockEnd,
        };
      }),
    );

    swaps = swaps.concat(chunkSwaps);
    debug(`+ ${chunkSwaps.length}`);
  }
  return swaps;
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
