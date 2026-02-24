import { secp256k1 } from "@noble/curves/secp256k1";
import { secureRandomBytes } from "./random";

export async function generateKeyPair() {
    const priv = await secureRandomBytes(32);
    const pub = secp256k1.getPublicKey(priv);
    return { privateKey: priv, publicKey: pub };
}

export function createSharedSecret(privateKey: Uint8Array, otherPublicKey: Uint8Array) {
    return secp256k1.getSharedSecret(privateKey, otherPublicKey);
}
