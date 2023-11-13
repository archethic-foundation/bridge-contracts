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
            timeout: 100000,
            natif: {
                pool: "0xcfBA4FA32527bFf23E073406c772e9a8b8D02650",
                reserve: "0x3FDf8f04cBe76c1376F593634096A5299B494678",
                safety: "0x57B5Fe2F6A28E108208BA4965d9879FACF629442",
                token: "ETH"
            },
            uco: {
                pool: "0x50b8B73327613468e5605eD59B980555DAAC354a",
                reserve: "0x4c5B45aD4347bAAF2E2d1817D0e1eea483910acc",
                safety: "0xbEF25E2b992494aF270092562e92aAC8394e0982",
                token: "0xCBBd3374090113732393DAE1433Bc14E5233d5d7"
            }
        },

        mumbai: {
            url: "https://polygon-mumbai.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
            timeout: 100000,
            natif: {
                pool: "0x56c86b45fCe906af9dF535EB27968aE46CBF170E",
                reserve: "0x64d75D315c592cCE1F83c53A201313C82b30FA8d",
                safety: "0xc20BcA1a8155c65964e5280D93d379aeB3A4c2e7",
                token: "MATIC"
            },
            uco: {
                pool: "0xe55915D112711127339f073e75185E6311Dd72C8",
                reserve: "0x5aAD864466491E81701103F04775EA7dE6d76fE3",
                safety: "0xbADc499dA1F766599d19dBa805CB62eFaa439Adc",
                token: "0x51279e98d99AA8D65763a885BEFA5463dCd84Af6"
            }
        },

        bsc_testnet: {
            url: "https://data-seed-prebsc-1-s2.bnbchain.org:8545",
            timeout: 100000,
            natif: {
                pool: "0xEF695C0C4034304300bD01f6C300a28000F2c163",
                reserve: "0x7F9E1c2Bb1Ab391bA9987070ED8e7db77A9c8818",
                safety: "0x6f3dec2738b063D9aFe4436b1ec307D84f9C2EDe",
                token: "BNB"
            },
            uco: {
                pool: "0xacc408CB6D6D9C73C6003269D322cb78150fc137",
                reserve: "0x157aB6F84d3a3874d1dEd1b0a63EC834C640FBda",
                safety: "0x95Cc38814d37E0A9b08f77a02Ff4045CeAd2106c",
                token: "0x5e6554593E4fe61276AD09094f16A6D5133461A5"
            }
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
