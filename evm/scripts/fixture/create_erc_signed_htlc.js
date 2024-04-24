const { ethers } = require("hardhat");
const crypto = require("crypto")
const {concatUint8Arrays, hexToUintArray, uintArrayToHex} = require("../../test/utils")

async function main() {

    const secret = crypto.randomBytes(32)
    const rawHash = crypto.createHash("sha256").update(secret).digest("hex")
    const hash = "0x" + rawHash

    const pool = await ethers.getContractAt("ERCPool", "0xaa74722D2cB78D4b5e52c2Ee7F12fe08851baa5F")
    const token = await ethers.getContractAt("DummyToken", "0xBdEC1c3Bd0719DBa0B82a06C66EBab35dc71240B")

    const lockTime = new Date()
    lockTime.setSeconds(lockTime.getSeconds() + 50)
    const lockTimeUnix = Math.floor(lockTime.getTime() / 1000)

    const buffer = new ArrayBuffer(32);
    const view = new DataView(buffer);
    view.setUint32(0x0, 31337, true);
    const networkIdUint8Array = new Uint8Array(buffer).reverse();

    const sigPayload = concatUint8Arrays([
        hexToUintArray(rawHash),
        networkIdUint8Array
    ])

    const signers = await ethers.getSigners()

    const hashedSigPayload2 = hexToUintArray(ethers.keccak256(`0x${uintArrayToHex(sigPayload)}`).slice(2))
    const signature = ethers.Signature.from(await signers[0].signMessage(hashedSigPayload2))

    await pool.provisionHTLC(hash, ethers.parseEther("0.001"), lockTimeUnix, signature.r, signature.s, signature.v)
    const htlcContract = await pool.provisionedSwap(hash)
    console.log(`HTLC provisioned at: ${htlcContract}`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
