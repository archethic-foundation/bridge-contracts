import { ethers } from "ethers";
import config from "config";
import fs from "fs";

const EVM_NETWORKS = config.get("evm");
const ERC20 = JSON.parse(
  fs.readFileSync(
    "../evm/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json",
  ),
);

export async function tick() {
  var promises = [];

  for (const [networkName, networkConf] of Object.entries(EVM_NETWORKS)) {
    const provider = new ethers.JsonRpcProvider(networkConf.providerEndpoint);
    const poolNativeAddress = networkConf.pools.NATIVE;
    const poolUCOAddress = networkConf.pools.UCO;

    // pool native balance
    promises.push(
      provider.getBalance(poolNativeAddress).then((value) => {
        return {
          name: `evm_${networkName}_pools_${networkConf.coin}_amount_${networkConf.coin}`,
          value,
        };
      }),
    );

    // pool UCO balance
    promises.push(
      provider.getBalance(poolUCOAddress).then((value) => {
        return {
          name: `evm_${networkName}_pools_UCO_amount_${networkConf.coin}`,
          value,
        };
      }),
    );

    const tokenContract = new ethers.Contract(
      networkConf.tokens.UCO,
      ERC20.abi,
      provider,
    );

    promises.push(
      tokenContract.balanceOf(poolUCOAddress).then((value) => {
        return {
          name: `evm_${networkName}_pools_UCO_amount_UCO`,
          value,
        };
      }),
    );
  }

  return Promise.all(promises);
}
