export default {
  environments: {
    local: {
      endpoint: "http://127.0.0.1:4000",
      userSeed: "user",
      keychainAccessSeed: "access",
      keychainSeed: "keychain"
    },
    testnet: {
      endpoint: "https://testnet.archethic.net",
    }
  },
  evmNetworks: {
    local: {
      endpoint: "http://127.0.0.1:8545",
      chainId: 31337,
      tokens: {
        UCO: {
          tokenAddress: "0xc944370f51eda8179b5180f5ab512134540939e3",
          proxyAddress: "0x24e57fc6cfb7f67928e32aee3e3ff98f0e968a5d",
          decimals: 18
        },
        aeETH: {
          tokenAddress: "NATIVE",
          proxyAddress: "0x26f8c6db23a4aa5293eeeee8a3317773e849cf44",
          decimals: 18
        }
      }
    },
    sepolia_ethereum: {
      endpoint: "https://sepolia.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
      chainId: 11155111
    },
    mumbai_polygon: {
      endpoint: "https://polygon-mumbai.g.alchemy.com/v2/-8zo2X19AmwNv7AGVIsGF5LWJQLc92Oj",
      chainId: 80001
    },
    bnb_chain_testnet: {
      endpoint: "https://polygon-mumbai.g.alchemy.com/v2/-8zo2X19AmwNv7AGVIsGF5LWJQLc92Oj",
      chainId: 97
    }
  },
  pools: {
    UCO: {
      availableEvmNetworks: {
        local: ["local"],
        testnet: ["sepolia_ethereum", "mumbai_polygon", "bnb_chain_testnet"]
      }
    },
    aeETH: {
      availableEvmNetworks: {
        local: ["local"],
        testnet: ["sepolia_ethereum"]
      }
    },
    aeBNB: {
      availableEvmNetworks: {
        local: ["local"],
        testnet: ["bnb_chain_testnet"]
      }
    },
    aeMATIC: {
      availableEvmNetworks: {
        local: ["local"],
        testnet: ["mumbai_polygon"]
      }
    }
  }
}
