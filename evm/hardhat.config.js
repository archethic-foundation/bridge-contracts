require("@nomicfoundation/hardhat-toolbox");
require('@openzeppelin/hardhat-upgrades');

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {},
        localhost: {
            url: "http://127.0.0.1:8545"
        },
        sepolia: {
            url: "https://sepolia.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
            accounts: [
                "49368e0291eaafffea4ee78fb3a713049bc7c1091a5926979eb842607ede147c"
            ]
        },

        mumbai: {
            url: "https://polygon-mumbai.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
            accounts: [
                "49368e0291eaafffea4ee78fb3a713049bc7c1091a5926979eb842607ede147c"
            ]
        },

        bsc_testnet: {
            url: "https://data-seed-prebsc-1-s1.binance.org:8545",
            accounts: [
                "49368e0291eaafffea4ee78fb3a713049bc7c1091a5926979eb842607ede147c"
            ]
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
  }
};