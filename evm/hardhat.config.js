require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("hardhat-tracer");
require("hardhat-contract-sizer");
require("@nomicfoundation/hardhat-ledger");

const { subtask } = require("hardhat/config");
const {
  TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
} = require("hardhat/builtin-tasks/task-names");
require("@nomicfoundation/hardhat-verify");

require("dotenv").config();

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      accounts: {
        mnemonic:
          "inflict author desk anxiety music swear acquire achieve link young benefit biology",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 10,
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: {
        mnemonic:
          "inflict author desk anxiety music swear acquire achieve link young benefit biology",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 10,
      },
    },
    sepolia: {
      url: "https://sepolia.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
      timeout: 100000,
      natif: {
        archethicPoolSigner: '0x28c9efc42e2cbdfb581c212fe1e918a480ca1421'
      },
      uco: {
        token: "0xCBBd3374090113732393DAE1433Bc14E5233d5d7",
        archethicPoolSigner: "0x85d7e244e533c7c71ef80f9a56fd1115bb9e5c69"
      },
      usdc: {
        token: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        archethicPoolSigner: "0x6bb165b6f8d06b2761227f1d90304edc24262291",
        multisig: "0x301fBf74d415D0452E1D2Ea0679C9E0077AF5246" // Safe
      },
      eure: {
        archethicPoolSigner: "0xd2d423aa5ac8cc0e02319d82cea1aa0f7ba57c4f",
        token: "0xd58C5Db52B5B3Eb24EE38AF287d2cb0F424172A5",
        multisig: "0x301fBf74d415D0452E1D2Ea0679C9E0077AF5246" // Safe
      }
    },

    ethereum: {
      ledgerAccounts: [
        "0xfD7C90fA69f76712239c733E564eE3D1EDCeCC12"
      ],
      url: "https://eth-mainnet.g.alchemy.com/v2/GIMnNlCFM3_7oQcUXOhKO4jIDLEA60q4",
      timeout: 100000,
      uco: {
        archethicPoolSigner: '0x16c1c9f1abcf2ba9e8d853827339dbeceaa91077',
        token: '0x8a3d77e9d6968b780564936d15B09805827C21fa',
        multisig: '0xEcA37F68c9ca7964fC0b3A7aB4f0D6e964f8FD68' // Safe
      },
      eure: {
        archethicPoolSigner: '0xf12bf6064165c24df79f268b7be7dc3213970df4',
        token: '0x3231Cb76718CDeF2155FC47b5286d82e6eDA273f',
        multisig: '0xEcA37F68c9ca7964fC0b3A7aB4f0D6e964f8FD68' // Safe
      },
      natif: {
        archethicPoolSigner: '0xbd788947035dc3edee57f38c82b143c2c529470c',
        multisig: '0xEcA37F68c9ca7964fC0b3A7aB4f0D6e964f8FD68' // Safe
      },
      wbtc: {
        archethicPoolSigner: '0xd55ea84e7174b7514f51e5dd7f56d74c36a4dbab',
        token: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        multisig: '0xEcA37F68c9ca7964fC0b3A7aB4f0D6e964f8FD68' // Safe
      },
    },

    // mumbai: {
    //   url: "https://polygon-mumbai.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
    //   timeout: 100000,
    //   natif: {
    //     pool: "0x56c86b45fCe906af9dF535EB27968aE46CBF170E",
    //     archethicPoolSigner: '0x4e57f0bf5813f5a516d23a59df1c767c4a3e8eef',
    //   },
    //   uco: {
    //     pool: "0xe55915D112711127339f073e75185E6311Dd72C8",
    //     token: "0x51279e98d99AA8D65763a885BEFA5463dCd84Af6",
    //   },
    // },

    polygon: {
      ledgerAccounts: [
        "0xfD7C90fA69f76712239c733E564eE3D1EDCeCC12"
      ],
      url: "https://polygon-mainnet.g.alchemy.com/v2/DynWKvz6PUFaeZNmlxPXNiV1nK4Ac_2D",
      timeout: 100000,
      uco: {
        archethicPoolSigner: '0x16c1c9f1abcf2ba9e8d853827339dbeceaa91077',
        token: '0x3C720206bFaCB2d16fA3ac0ed87D2048Dbc401Fc',
        multisig: '0x114F7a61F436f85f3Dba03da7a7c744689aA6a42'
      },
      weth: {
        archethicPoolSigner: '0xbd788947035dc3edee57f38c82b143c2c529470c',
        token: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
        multisig: '0x114F7a61F436f85f3Dba03da7a7c744689aA6a42'
      },
      eure: {
        archethicPoolSigner: '0xf12bf6064165c24df79f268b7be7dc3213970df4',
        token: '0x18ec0A6E18E5bc3784fDd3a3634b31245ab704F6',
        multisig: '0x114F7a61F436f85f3Dba03da7a7c744689aA6a42'
      },
      wbtc: {
        archethicPoolSigner: '0xd55ea84e7174b7514f51e5dd7f56d74c36a4dbab',
        token: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
        multisig: '0x114F7a61F436f85f3Dba03da7a7c744689aA6a42'
      }
    },

    bsc_testnet: {
      url: "https://data-seed-prebsc-1-s2.bnbchain.org:8545",
      timeout: 100000,
      natif: {
        archethicPoolSigner: '0x461ac2fa849767e4059fd98903a61315434ccf64',
      },
      uco: {
        token: "0x5e6554593E4fe61276AD09094f16A6D5133461A5",
        archethicPoolSigner: "0x85d7e244e533c7c71ef80f9a56fd1115bb9e5c69"
      },
    },

    bsc_mainnet: {
      ledgerAccounts: [
        "0xfD7C90fA69f76712239c733E564eE3D1EDCeCC12"
      ],
      url: "https://bsc-dataseed.binance.org",
      timeout: 100000,
      uco: {
        archethicPoolSigner: '0x16c1c9f1abcf2ba9e8d853827339dbeceaa91077',
        token: '0xb001f1E7c8bda414aC7Cf7Ecba5469fE8d24B6de',
        multisig: '0x9D1392165debAAA889dE2328b0626aD1BCd9F6a8'
      }
    }
  },

  etherscan: {
    apiKey: {
      mainnet: process.env["ETHERSCAN_API_KEY"],
      sepolia: process.env["ETHERSCAN_API_KEY"],
      bsc: process.env["BSCSCAN_API_KEY"],
      polygon: process.env["POLYGONSSCAN_API_KEY"]
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  solidity: {
    version: "0.8.21", // Fetch exact version from solc-bin
    settings: {
      optimizer: {
        enabled: true,
        runs: 100, // Optimize gas for function call instead of deployment
      },
    },
  },

  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    strict: true,
  },

  defender: {
    apiKey: process.env.DEFENDER_KEY,
    apiSecret: process.env.DEFENDER_SECRET,
  },
};

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(
  async (_, __, runSuper) => {
    const paths = await runSuper();
    const inclusionContract = process.env["ONLY_CONTRACT"];

    return paths.filter((p) => {
      if (inclusionContract) {
        return p.includes(inclusionContract);
      }
      return true;
    });
  },
);
