const { ethers, upgrades, network } = require("hardhat");

async function main() {
    const { reserveAddress, safetyModuleAddress, archethicPoolSigner, poolCap, tokenAddress } = await poolConfiguration()
    const safetyModuleFeeRate = 5 // 0.05%
    const lockTimePeriod = 7200; // 2H

    const ERCPool = await ethers.getContractFactory("ERCPool");
    const instance = await upgrades.deployProxy(ERCPool, [
        reserveAddress,
        safetyModuleAddress,
        safetyModuleFeeRate,
        archethicPoolSigner,
        poolCap,
        lockTimePeriod,
        tokenAddress
    ]);

    console.log(`ERC pool deployed at: ${await instance.getAddress()}`)
}

async function poolConfiguration() {
    const accounts = await ethers.getSigners()

    switch (network.name) {
        case "sepolia":
            return {
                reserveAddress: "0x4c5B45aD4347bAAF2E2d1817D0e1eea483910acc",
                safetyModuleAddress: "0xbEF25E2b992494aF270092562e92aAC8394e0982",
                archethicPoolSigner: '0x85d7e244e533c7c71ef80f9a56fd1115bb9e5c69',
                poolCap: ethers.parseEther('5'),
                tokenAddress: '0xCBBd3374090113732393DAE1433Bc14E5233d5d7'
            }

        case "mumbai":
            return {
                reserveAddress: "0x5aAD864466491E81701103F04775EA7dE6d76fE3",
                safetyModuleAddress: "0xbADc499dA1F766599d19dBa805CB62eFaa439Adc",
                archethicPoolSigner: '0x85d7e244e533c7c71ef80f9a56fd1115bb9e5c69',
                poolCap: ethers.parseEther('5'),
                tokenAddress: '0x51279e98d99AA8D65763a885BEFA5463dCd84Af6'
            }

        case "bsc_testnet":
            return {
                reserveAddress: "0x157aB6F84d3a3874d1dEd1b0a63EC834C640FBda",
                safetyModuleAddress: "0x95Cc38814d37E0A9b08f77a02Ff4045CeAd2106c",
                archethicPoolSigner: '0x85d7e244e533c7c71ef80f9a56fd1115bb9e5c69',
                poolCap: ethers.parseEther('5'),
                tokenAddress: '0x5e6554593E4fe61276AD09094f16A6D5133461A5'
            }

        default:
            const contract = await ethers.deployContract("DummyToken", [ethers.parseEther('200000')])
            console.log(`Deployed token at: ${await contract.getAddress()}`)
            return {
                reserveAddress: accounts[4].address,
                safetyModuleAddress: accounts[5].address,
                archethicPoolSigner: '0xcb2276e4760757976438922aaeb0e03114d5b45f',
                poolCap: ethers.parseEther('200'),
                tokenAddress: await contract.getAddress()
            }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

