/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * https://trufflesuite.com/docs/truffle/reference/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like @truffle/hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

// require('dotenv').config();
// const mnemonic = process.env["MNEMONIC"];
// const infuraProjectId = process.env["INFURA_PROJECT_ID"];

const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    development: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 8545,            // Standard Ethereum port (default: none)
      network_id: "*",       // Any network (default: none)
    },

    sepolia: {
      network_id: 11155111,
      provider: () => new HDWalletProvider({
        privateKeys: [
          "49368e0291eaafffea4ee78fb3a713049bc7c1091a5926979eb842607ede147c"
        ],
        providerOrUrl: "https://sepolia.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a"
      }),
      confirmations: 2,
      skipDryRun: true
    },

    mumbai: {
      network_id: 80001,
      provider: () => new HDWalletProvider({
        privateKeys: [
          "49368e0291eaafffea4ee78fb3a713049bc7c1091a5926979eb842607ede147c"
        ],
        providerOrUrl: "https://polygon-mumbai.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a"
      }),
      confirmations: 2,
      skipDryRun: true
    },

    bsc_testnet: {
      network_id: 97,
      provider: () => new HDWalletProvider({
        privateKeys: [
          "49368e0291eaafffea4ee78fb3a713049bc7c1091a5926979eb842607ede147c"
        ],
        providerOrUrl: "https://data-seed-prebsc-1-s1.binance.org:8545"
      }),
      confirmations: 2,
      skipDryRun: true
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.13",      // Fetch exact version from solc-bin
      settings: {
        optimizer: {
          enabled: true,
          runs: 10000, // Optimize gas for function call instead of deployment
        },
      }
    }
  },

  plugins: [
    "truffle-contract-size"
  ]
};
