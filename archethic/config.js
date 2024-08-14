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
      endpoints: ["http://127.0.0.1:8545", "http://127.0.0.1:8546"],
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
      endpoints: [
        "https://sepolia.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
        "https://eth-sepolia.g.alchemy.com/v2/eLhVAxz79HO5n2y98mdIl_gMkKSDc3G8",
      ],
      chainId: 11155111,
      tokens: {
        UCO: {
          proxyAddress: "0x08Bfc8BA9fD137Fb632F79548B150FE0Be493254",
          decimals: 18,
        },
        aeETH: {
          proxyAddress: "0xe983d3dBCB15038dbF2AE69A445A5576B0280d1c",
          decimals: 18,
        },
        aeUSDC: {
          proxyAddress: "0xC53A7c2f8C988AA319F0ACAd211dBb7206D5586e",
          decimals: 18,
        },
        aeEURe: {
          proxyAddress: "0x15b9B55b3B96Ff49902F2B23cD46A8404F222058",
          decimals: 18
        }
      },
    },
    mumbai_polygon: {
      endpoints: [
        "https://polygon-mumbai.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
        "https://polygon-mumbai.g.alchemy.com/v2/YrTBjcxLttewqhFia5IhwwHqesNkLmBC",
      ],
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
      endpoints: [
        "https://data-seed-prebsc-1-s2.bnbchain.org:8545",
        "https://bsc-testnet.bnbchain.org",
      ],
      chainId: 97,
      tokens: {
        UCO: {
          proxyAddress: "0xb361b5AC4eAEb918dCed9d60417975c89556DDEA",
          decimals: 18,
        },
        aeBNB: {
          proxyAddress: "0x3Fa0d410064FcE2744e4feebB3Be338e1fA3C967",
          decimals: 18,
        },
      },
    },
    bnb_chain: {
      endpoints: [
        "https://bsc-dataseed.binance.org",
        "https://bsc-mainnet.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
      ],
      chainId: 56,
      tokens: {
        UCO: {
          proxyAddress: "0xE01F0ee653648192812B2D23CBfe7E147727B672",
          decimals: 18,
        },
        aeETH: {
          proxyAddress: "0x947DE182C16C8ee2851529aE574058D5837D47c9",
          decimals: 18,
        },
        aeBTC: {
          proxyAddress: "0x73a0aB31DED89aF1F9CDcB115B3E32f111d9f648",
          decimals: 18
        }
      },
    },
    ethereum: {
      endpoints: [
        "https://mainnet.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
        "https://eth-mainnet.g.alchemy.com/v2/tgCq5a1zrmYn4ZjEn74UAW9gUXlDPzQi",
      ],
      chainId: 1,
      tokens: {
        UCO: {
          proxyAddress: "0x346Dba8b51485FfBd4b07B0BCb84F48117751AD9",
          decimals: 18,
        },
        aeETH: {
          proxyAddress: "0x37A57dB56F558435a16C31dBeDe48F278545A37e",
          decimals: 18,
        },
        aeEURe: {
          proxyAddress: "0xAbAb69EF6bCE7F57DB741680adADC3827A6325eB",
          decimals: 18
        },
        aeBTC: {
          proxyAddress: "0xB141cA8ECE6409198B8543A9BdFbF088Fc8010A8",
          decimals: 8
        }
      },
    },
    polygon_pos: {
      endpoints: [
        "https://polygon-mainnet.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
        "https://polygon-mainnet.g.alchemy.com/v2/0aM2uAp3J-LsOlijDBZ3aZiCUvZdjiHb",
      ],
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
        aeEURe: {
          proxyAddress: "0xF6922A1C40788C8519E42797eD9242552979b60D",
          decimals: 18
        },
        aeBTC: {
          proxyAddress: "0x71A5f7d244C3a5EedC00dA4933336e35115E73c7",
          decimals: 8
        }
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
        mainnet: ["polygon_pos", "ethereum", "bnb_chain"],
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
        testnet: ["sepolia_ethereum"],
      },
    },
    aeEURe: {
      availableEvmNetworks: {
        testnet: ["sepolia_ethereum"],
        mainnet: ["polygon_pos", "ethereum"]
      }
    },
    aeBTC: {
      availableEvmNetworks: {
        mainnet: ["ethereum", "polygon_pos", "bnb_chain"]
      }
    }
  },
};
