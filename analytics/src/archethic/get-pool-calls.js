import Debug from "debug";
import config from "config";

const SINCE = config.get("since") || -1;

const debug = Debug("archethic:calls");

export default async function (archethic, poolGenesisAddress, pagingAddress) {
  let fundsCalls = [];
  let secretHashCalls = [];
  let setSecretHashCalls = [];
  let revealSecretCalls = [];
  let failedCalls = [];
  let previousPagingAddress;

  do {
    previousPagingAddress = pagingAddress;
    // Fetch pool chain (batch of 10 txs), retrieve each transaction's inputs
    // filter call inputs and retrieve call details
    const res = await nextPage(archethic, poolGenesisAddress, pagingAddress);

    debug(
      `${poolGenesisAddress}: found ${res.fundsCalls.length} chargeable HTLCs`,
    );
    debug(
      `${poolGenesisAddress}: found ${res.secretHashCalls.length} signed HTLCs`,
    );

    fundsCalls.push(...res.fundsCalls);
    secretHashCalls.push(...res.secretHashCalls);
    setSecretHashCalls.push(...res.setSecretHashCalls);
    revealSecretCalls.push(...res.revealSecretCalls);
    failedCalls.push(...res.failedCalls);
    pagingAddress = res.pagingAddress;
  } while (previousPagingAddress != pagingAddress);

  return {
    fundsCalls,
    secretHashCalls,
    setSecretHashCalls,
    revealSecretCalls,
    failedCalls,
    pagingAddress,
  };
}

async function nextPage(archethic, poolGenesisAddress, pagingAddress) {
  let query = poolChainQuery(poolGenesisAddress, pagingAddress);
  const { transactionChain: poolTxs } =
    await archethic.network.rawGraphQLQuery(query);

  const failedCalls = [];
  const setSecretHashCalls = [];
  const signedRevealSecretCalls = [];

  const callQueries = poolTxs
    .filter((poolTx) => poolTx.validationStamp.timestamp > SINCE)
    .reduce((acc, poolTx) => {
      const call = poolTx.validationStamp.ledgerOperations.consumedInputs.find(
        (input) => input.type == "call",
      );

      const recipients = poolTx.data.actionRecipients;
      if (recipients.length > 0 && recipients[0].action == "set_secret_hash") {
        setSecretHashCalls.push(poolTx);
      }
      if (recipients.length > 0 && recipients[0].action == "reveal_secret") {
        signedRevealSecretCalls.push(poolTx);
      }

      // some transactions are of type token so there is no call consumed
      return call ? acc + "\n" + callQuery(poolTx.address, call.from) : acc;
    }, "");

  if (!poolTxs.length) {
    // returning the same pagingAddress wil break the while loop
    return {
      fundsCalls: [],
      secretHashCalls: [],
      setSecretHashCalls: [],
      revealSecretCalls: [],
      failedCalls: [],
      pagingAddress,
    };
  }

  const [{ address: nextPagingAddress }] = poolTxs.slice(-1);

  if (!callQueries) {
    // we skipped them because of SINCE
    return {
      fundsCalls: [],
      secretHashCalls: [],
      setSecretHashCalls: [],
      revealSecretCalls: [],
      failedCalls: [],
      pagingAddress: nextPagingAddress,
    };
  }

  query = `query {
    ${callQueries}
  }`;

  const callTxs = await archethic.network.rawGraphQLQuery(query);

  const {
    fundsCalls,
    secretHashCalls,
    revealSecretCalls: chargeableRevealSecretCalls,
  } = splitCallTxs(callTxs);

  return {
    fundsCalls,
    secretHashCalls,
    setSecretHashCalls,
    revealSecretCalls: [
      ...chargeableRevealSecretCalls,
      ...signedRevealSecretCalls,
    ],
    failedCalls,
    pagingAddress: nextPagingAddress,
  };
}

function splitCallTxs(callTxs) {
  const fundsCalls = [];
  const secretHashCalls = [];
  const revealSecretCalls = [];

  Object.values(callTxs).forEach((call) => {
    call.data.actionRecipients.forEach((recipient) => {
      switch (recipient.action) {
        case "request_funds":
          fundsCalls.push(call);
          break;

        case "request_secret_hash":
          secretHashCalls.push(call);
          break;

        case "reveal_secret":
          revealSecretCalls.push(call);
          break;

        default:
          break;
      }
    });
  });

  return { fundsCalls, secretHashCalls, revealSecretCalls };
}

function callQuery(address, callAddress) {
  return `X${address}: transaction(address: "${callAddress}") {
    address
    data {
      actionRecipients {
        action, args
      }
    }
    validationStamp {
      timestamp
      ledgerOperations {
        transactionMovements {
          to
        }
      }
    }
  }`;
}

function poolChainQuery(poolGenesisAddress, pagingAddress) {
  if (pagingAddress) {
    return `query {
      transactionChain(
        address: "${poolGenesisAddress}",
        pagingAddress: "${pagingAddress}"
      ) {
		    address
        data {
          actionRecipients {
            address, action, args
          }
        }
        validationStamp {
          timestamp
          ledgerOperations{
            consumedInputs {
              type
              from
            }
          }
        }
      }
    }`;
  } else {
    return `query {
      transactionChain(
        address: "${poolGenesisAddress}"
      ) {
		    address
        data {
          actionRecipients {
            address, action, args
          }
        }
        validationStamp {
          timestamp
          ledgerOperations{
            consumedInputs {
              type
              from
            }
          }
        }
      }
    }`;
  }
}
