import { Crypto, Utils } from "archethic"
import keccak256 from "keccak256"

const args = []
process.argv.forEach(function(val, index, _array) { if (index > 1) { args.push(val) } })

if (args.length != 1) {
  console.log("Missing arguments")
  console.log("Usage: node derive_eth_address.js [\"UCO\" | \"tokenSymbol\"]")
  process.exit(1)
}

const token = args[0]
const seed = Crypto.hash(token).slice(1)

const { publicKey } = Crypto.deriveKeyPair(seed, 0, "secp256k1")

// Slice 3 to remove first 2 bytes (curve / origin) and 3rd byte hardcoded as 4 in ethereum
const hash = keccak256(Buffer.from(publicKey.slice(3)))
const eth_address = [...hash].slice(-20)

console.log("0x" + Utils.uint8ArrayToHex(eth_address))
