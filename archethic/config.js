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
      chainId: 31337
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
