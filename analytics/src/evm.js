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
    const reserveNativeAddress = networkConf.reserves.NATIVE;
    const reserveUCOAddress = networkConf.reserves.UCO;
    const safetyModuleNativeAddress = networkConf.safetyModules.NATIVE;
    const safetyModuleUCOAddress = networkConf.safetyModules.UCO;

    const tokenContract = new ethers.Contract(
      networkConf.tokens.UCO,
      ERC20.abi,
      provider,
    );

    // pool native balance
    promises.push(
      provider.getBalance(poolNativeAddress).then((value) => {
        return {
          name: `evm_${networkName}_pools_${networkConf.coin}`,
          value,
        };
      }),
    );

    // pool UCO balance
    promises.push(
      tokenContract.balanceOf(poolUCOAddress).then((value) => {
        return {
          name: `evm_${networkName}_pools_UCO`,
          value,
        };
      }),
    );

    // safety module native balance
    promises.push(
      provider.getBalance(safetyModuleNativeAddress).then((value) => {
        return {
          name: `evm_${networkName}_safetyModule_${networkConf.coin}`,
          value,
        };
      }),
    );
    // safety module UCO balance
    promises.push(
      tokenContract.balanceOf(safetyModuleUCOAddress).then((value) => {
        return {
          name: `evm_${networkName}_safetyModule_UCO`,
          value,
        };
      }),
    );
    // reserve native balance
    promises.push(
      provider.getBalance(reserveNativeAddress).then((value) => {
        return {
          name: `evm_${networkName}_reserve_${networkConf.coin}`,
          value,
        };
      }),
    );
    // reserve UCO balance
    promises.push(
      tokenContract.balanceOf(reserveUCOAddress).then((value) => {
        return {
          name: `evm_${networkName}_reserve_UCO`,
          value,
        };
      }),
    );
  }

  return Promise.all(promises);
}
