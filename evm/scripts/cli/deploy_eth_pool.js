const { ethers, upgrades, network } = require("hardhat");
const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
})

// pool signer is generated via this CLI:
//
// node bridge derive_eth_address --token UCO
async function promptPoolSigner() {
    return new Promise(r => {
        readline.question("Pool signer [default: 0x200066681c09a9a8c9352fac9b96a688a4ae0b39]: ", input => {
            if (input == "")
                return r("0x200066681c09a9a8c9352fac9b96a688a4ae0b39")

            r(input)
        })
    })
}

async function main() {
    const poolSigner = await promptPoolSigner()

    // not very useful to prompt this
    const lockTimePeriod = 7200; // 2H

    const ETHPool = await ethers.getContractFactory("ETHPool");
    const accounts = await ethers.getSigners()
    const instance = await upgrades.deployProxy(ETHPool, [
        poolSigner,
        lockTimePeriod,
        accounts[0].address
    ]);

    console.log(`ETH pool deployed at: ${await instance.getAddress()}`)
}



main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
