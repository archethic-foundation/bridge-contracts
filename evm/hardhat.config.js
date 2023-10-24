require("@nomicfoundation/hardhat-toolbox");
require('@openzeppelin/hardhat-upgrades');
require("hardhat-tracer");
require("hardhat-contract-sizer");

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            accounts: {
                mnemonic: "inflict author desk anxiety music swear acquire achieve link young benefit biology",
                path: "m/44'/60'/0'/0",
                initialIndex: 0,
                count: 10,
            },
        },
        localhost: {
            url: "http://127.0.0.1:8545",
            accounts: {
                mnemonic: "inflict author desk anxiety music swear acquire achieve link young benefit biology",
                path: "m/44'/60'/0'/0",
                initialIndex: 0,
                count: 10,
            },
        },
        sepolia: {
            url: "https://sepolia.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
            accounts: [
                "49368e0291eaafffea4ee78fb3a713049bc7c1091a5926979eb842607ede147c"
            ],
            timeout: 100000
        },

        mumbai: {
            url: "https://polygon-mumbai.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
            accounts: [
                "49368e0291eaafffea4ee78fb3a713049bc7c1091a5926979eb842607ede147c"
            ],
            timeout: 100000
        },

        bsc_testnet: {
            url: "https://endpoints.omniatech.io/v1/bsc/testnet/public",
            accounts: [
                "49368e0291eaafffea4ee78fb3a713049bc7c1091a5926979eb842607ede147c"
            ],
            timeout: 100000
        }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  solidity: {
    version: "0.8.21",      // Fetch exact version from solc-bin
    settings: {
        optimizer: {
            enabled: true,
            runs: 10000, // Optimize gas for function call instead of deployment
        },
    }
  },

  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    strict: true
  }
};
