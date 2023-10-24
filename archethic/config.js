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
          proxyAddress: "0xaa74722d2cb78d4b5e52c2ee7f12fe08851baa5f",
          decimals: 18
        },
        aeETH: {
          proxyAddress: "0x39c9dbd60b0eaf256ebc509d2b837d508dd4f2da",
          decimals: 18
        }
      }
    },
    sepolia_ethereum: {
      endpoint: "https://sepolia.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
      chainId: 11155111,
      tokens: {
        UCO: {
          proxyAddress: "0x50b8b73327613468e5605ed59b980555daac354a",
          decimals: 18
        },
        aeETH: {
          proxyAddress: "0xcfba4fa32527bff23e073406c772e9a8b8d02650",
          decimals: 18
        }
      }
    },
    mumbai_polygon: {
      endpoint: "https://polygon-mumbai.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
      chainId: 80001,
      tokens: {
        UCO: {
          proxyAddress: "0xcfba4fa32527bff23e073406c772e9a8b8d02650",
          decimals: 18
        },
        aeMATIC: {
          proxyAddress: "0xb7b2e4de4d386b73afa7f79c9769beda06ea6b4f",
          decimals: 18
        }
      }
    },
    bnb_chain_testnet: {
      endpoint: "https://data-seed-prebsc-1-s2.bnbchain.org:8545",
      chainId: 97,
      tokens: {
        UCO: {
          proxyAddress: "0xacc408cb6d6d9c73c6003269d322cb78150fc137",
          decimals: 18
        },
        aeBNB: {
          proxyAddress: "0xef695c0c4034304300bd01f6c300a28000f2c163",
          decimals: 18
        }
      }
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
