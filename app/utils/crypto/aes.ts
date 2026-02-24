import { AESGCM } from "@stablelib/gcm";
import { secureRandomBytes } from "./random";

export async function encrypt(key: Uint8Array, plaintext: string) {
    const iv = await secureRandomBytes(12);
    const aes = new AESGCM(key);
    const encoded = new TextEncoder().encode(plaintext);
    const cipher = aes.seal(iv, encoded);
    return { iv, cipher };
}

export function decrypt(key: Uint8Array, iv: Uint8Array, cipher: Uint8Array) {
    const aes = new AESGCM(key);
    const plain = aes.open(iv, cipher);
    if (!plain) throw new Error("Decryption failed");
    return new TextDecoder().decode(plain);
}
