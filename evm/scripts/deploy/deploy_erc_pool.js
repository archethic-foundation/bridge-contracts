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
                reserveAddress: "0x3FDf8f04cBe76c1376F593634096A5299B494678",
                safetyModuleAddress: "0x57B5Fe2F6A28E108208BA4965d9879FACF629442",
                archethicPoolSigner: '0x85d7e244e533c7c71ef80f9a56fd1115bb9e5c69',
                poolCap: ethers.parseEther('5'),
                tokenAddress: '0xCBBd3374090113732393DAE1433Bc14E5233d5d7'
            }

        case "mumbai":
            return {
                reserveAddress: "0x64d75D315c592cCE1F83c53A201313C82b30FA8d",
                safetyModuleAddress: "0xc20BcA1a8155c65964e5280D93d379aeB3A4c2e7",
                archethicPoolSigner: '0x85d7e244e533c7c71ef80f9a56fd1115bb9e5c69',
                poolCap: ethers.parseEther('5'),
                tokenAddress: '0x51279e98d99AA8D65763a885BEFA5463dCd84Af6'
            }

        case "bsc_testnet":
            return {
                reserveAddress: "0x7F9E1c2Bb1Ab391bA9987070ED8e7db77A9c8818",
                safetyModuleAddress: "0x6f3dec2738b063D9aFe4436b1ec307D84f9C2EDe",
                archethicPoolSigner: '0x85d7e244e533c7c71ef80f9a56fd1115bb9e5c69',
                poolCap: ethers.parseEther('5'),
                tokenAddress: '0x51279e98d99AA8D65763a885BEFA5463dCd84Af6'
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
