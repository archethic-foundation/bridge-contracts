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

async function promptReserveAddress() {
    return new Promise(r => {
        readline.question("Reserve's address [default: 0x4Cd7ce379953FeDd88938a9a4385f8D2bd77BD1d]: ", input => {
            if (input == "")
                return r("0x4Cd7ce379953FeDd88938a9a4385f8D2bd77BD1d")

            r(input)
        })
    })
}

async function promptSafetyModuleAddress() {
    return new Promise(r => {
        readline.question("SafetyModule's address [default: 0x37f82d5cD6e75F9270eACab4dfacEeB881259722]: ", input => {
            if (input == "")
                return r("0x37f82d5cD6e75F9270eACab4dfacEeB881259722")

            r(input)
        })
    })
}

async function promptPoolCap() {
    return new Promise(r => {
        readline.question("Pool cap [default: 200]: ", input => {
            if (input == "")
                return r(ethers.parseEther("200"))

            r(ethers.parseEther(input))
        })
    })
}


async function main() {
    const reserveAddress = await promptReserveAddress()
    const safetyModuleAddress = await promptSafetyModuleAddress()
    const poolSigner = await promptPoolSigner()
    const poolCap = await promptPoolCap()

    // not very useful to prompt this
    const safetyModuleFeeRate = 5 // 0.05%
    const lockTimePeriod = 7200; // 2H

    const ETHPool = await ethers.getContractFactory("ETHPool");
    const instance = await upgrades.deployProxy(ETHPool, [
        reserveAddress,
        safetyModuleAddress,
        safetyModuleFeeRate,
        poolSigner,
        poolCap,
        lockTimePeriod
    ]);

    console.log(`ETH pool deployed at: ${await instance.getAddress()}`)
}



main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
