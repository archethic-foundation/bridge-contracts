export default {
  environments: {
    local: {
      endpoint: "http://127.0.0.1:4000",
      userSeed: "user",
      keychainAccessSeed: "access",
      keychainSeed: "keychain",
    },
    testnet: {
      endpoint: "https://testnet.archethic.net",
    },
    mainnet: {
      endpoint: "https://mainnet.archethic.net",
    },
  },
  evmNetworks: {
    local: {
      endpoint: "http://127.0.0.1:8545",
      chainId: 31337,
      tokens: {
        UCO: {
          proxyAddress: "0xaa74722d2cb78d4b5e52c2ee7f12fe08851baa5f",
          decimals: 18,
        },
        aeETH: {
          proxyAddress: "0x39c9dbd60b0eaf256ebc509d2b837d508dd4f2da",
          decimals: 18,
        },
      },
    },
    sepolia_ethereum: {
      endpoint: "https://sepolia.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
      chainId: 11155111,
      tokens: {
        UCO: {
          proxyAddress: "0x50b8b73327613468e5605ed59b980555daac354a",
          decimals: 18,
        },
        aeETH: {
          proxyAddress: "0xcfba4fa32527bff23e073406c772e9a8b8d02650",
          decimals: 18,
        },
        aeUSDC: {
          proxyAddress: "0xC53A7c2f8C988AA319F0ACAd211dBb7206D5586e",
          decimals: 18
        }
      },
    },
    mumbai_polygon: {
      endpoint:
        "https://polygon-mumbai.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
      chainId: 80001,
      tokens: {
        UCO: {
          proxyAddress: "0xe55915d112711127339f073e75185e6311dd72c8",
          decimals: 18,
        },
        aeMATIC: {
          proxyAddress: "0x56c86b45fce906af9df535eb27968ae46cbf170e",
          decimals: 18,
        },
        aeETH: {
          proxyAddress: "0x018a6673063514aeeb028890c48ee68f62bd7cad",
          decimals: 18,
        },
      },
    },
    bnb_chain_testnet: {
      endpoint: "https://data-seed-prebsc-1-s2.bnbchain.org:8545",
      chainId: 97,
      tokens: {
        UCO: {
          proxyAddress: "0xacc408cb6d6d9c73c6003269d322cb78150fc137",
          decimals: 18,
        },
        aeBNB: {
          proxyAddress: "0xef695c0c4034304300bd01f6c300a28000f2c163",
          decimals: 18,
        },
      },
    },
    bnb_chain: {
      endpoint: "https://bsc-dataseed.binance.org",
      chainId: 56,
      tokens: {
        UCO: {
          proxyAddress: "0xE01F0ee653648192812B2D23CBfe7E147727B672",
          decimals: 18,
        },
      },
    },
    ethereum: {
      endpoint: "https://mainnet.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
      chainId: 1,
      tokens: {
        UCO: {
          proxyAddress: "0x346Dba8b51485FfBd4b07B0BCb84F48117751AD9",
          decimals: 18,
        },
      }
    },
    polygon_pos: {
      endpoint: "https://polygon-mainnet.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
      chainId: 137,
      tokens: {
        UCO: {
          proxyAddress: "0xd5cA9F76495b853a5054814A10b6365ee8ed745B",
          decimals: 18,
        },
        aeETH: {
          proxyAddress: "0xbc6df50b5c5DD12c93c2B98828Befdd8095388ca",
          decimals: 18,
        },
      },
    },
  },
  pools: {
    UCO: {
      availableEvmNetworks: {
        local: ["local"],
        testnet: ["sepolia_ethereum", "mumbai_polygon", "bnb_chain_testnet"],
        mainnet: ["bnb_chain", "polygon_pos", "ethereum"],
      },
    },
    aeETH: {
      availableEvmNetworks: {
        local: ["local"],
        testnet: ["sepolia_ethereum", "mumbai_polygon"],
        mainnet: ["polygon_pos"]
      },
    },
    aeBNB: {
      availableEvmNetworks: {
        local: ["local"],
        testnet: ["bnb_chain_testnet"],
      },
    },
    aeMATIC: {
      availableEvmNetworks: {
        local: ["local"],
        testnet: ["mumbai_polygon"],
      },
    },
    aeUSDC: {
      availableEvmNetworks: {
        testnet: ["sepolia_ethereum"]
      },
    }
  },
};
