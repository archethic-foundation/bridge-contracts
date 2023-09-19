const secp256k1= require("secp256k1")
const { randomBytes } = require("crypto");
const keccak256 = require("keccak256")

function increaseTime(secondsToAdd) {
    return new Promise((resolve, reject) => {
        const id = Date.now();

        web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_increaseTime',
            params: [secondsToAdd],
            id,
        }, (err1) => {
            if (err1) {
                return reject(err1);
            }
            web3.currentProvider.send({
                jsonrpc: '2.0',
                method: 'evm_mine',
                id: id + 1,
              }, (err2, res) => {
                if (err2) {
                    return reject(err2)
                }
                resolve(res)
            })
        });
    });
}

function generateECDSAKey() {
   let privateKey
    do {
        privateKey = randomBytes(32)
    } while (!secp256k1.privateKeyVerify(privateKey))

    // get the public key in a compressed format
    const pubKey = secp256k1.publicKeyCreate(privateKey)

   return { pubKey, privateKey }
}

function signECDSA (privateKey, data) {
    const { signature, recid} = secp256k1.ecdsaSign(data, privateKey)

    if (recid == 1) {
        return { signature, recid: 0x1c }
    }
    else {
        return { signature, recid: 0x1b }
    }
}

function concatUint8Arrays(arrays) {
    let totalLength = 0;
    for (let arr of arrays) {
        totalLength += arr.length;
    }
    let result = new Uint8Array(totalLength);
    let offset = 0;
    for (let arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

function hexToUintArray(hexString) {
    return new Uint8Array(
        hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
    );
}

function uintArrayToHex(bytes) {
    return Buffer.from(bytes).toString("hex");
}

function createEthSign(hash, privateKey) {
    const signData = concatUint8Arrays([
        new TextEncoder().encode("\x19Ethereum Signed Message:\n32"),
        hash
    ])

    const signedMessage = keccak256(Buffer.from(signData))
    const { signature, recid } = signECDSA(privateKey, signedMessage)

    const sigHex = uintArrayToHex(signature)
    const r = sigHex.slice(0, 64)
    const s = sigHex.slice(64, 128)

    return { r, s, v: recid}
}

module.exports.increaseTime = increaseTime
module.exports.concatUint8Arrays = concatUint8Arrays
module.exports.signECDSA = signECDSA
module.exports.generateECDSAKey = generateECDSAKey
module.exports.hexToUintArray = hexToUintArray
module.exports.uintArrayToHex = uintArrayToHex
module.exports.createEthSign = createEthSign

