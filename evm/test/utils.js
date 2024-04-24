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

module.exports.concatUint8Arrays = concatUint8Arrays
module.exports.hexToUintArray = hexToUintArray
module.exports.uintArrayToHex = uintArrayToHex