import { Utils } from "@archethicjs/sdk";

export default async function (archethic, address) {
  const query = `query {
    balance (address: "${address}") {
      uco
    }
  }`;

  const {
    balance: { uco: amount },
  } = await archethic.network.rawGraphQLQuery(query);

  return Utils.fromBigInt(amount);
}
