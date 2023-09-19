const { createEthSign, hexToUintArray } = require("./test/utils")

let args = []
process.argv.forEach(function (val, index, array) {
    if (index > 1) {
        args.push(val)
    }
});

if (args.length != 2) {
    console.log("Missing arguments")
    console.log("Usage: node signing_tool.js [digest as 0x......] [key as 0x.....]")
    return
}

for(let i = 0; i < 2; i++) {
    const arg = args[i];
    if(! /^0x[0-9a-fA-F]+$/.test(arg)) {
        if(i == 0) {
            console.log("Digest must be like 0x...")
            break
        }
        else {
            console.log("Private key must be like 0x...")
            break
        }
    }
}

const data = args[0]
const key = args[1]

const signature = createEthSign(hexToUintArray(data.substr(2)), hexToUintArray(key.substr(2)))
console.log("Signature generated with the following values:")
console.log(signature)