import { GCM } from "@stablelib/gcm";
import { AES } from "@stablelib/aes";
import { secureRandomBytes } from "./random";

export async function encrypt(key: Uint8Array, plaintext: string) {
    const iv = await secureRandomBytes(12);
    const aes = new GCM(new AES(key));
    const encoded = new TextEncoder().encode(plaintext);
    const cipher = aes.seal(iv, encoded);
    return { iv, cipher };
}

export function decrypt(key: Uint8Array, iv: Uint8Array, cipher: Uint8Array) {
    const aes = new GCM(new AES(key));
    const plain = aes.open(iv, cipher);
    if (!plain) throw new Error("Decryption failed");
    return new TextDecoder().decode(plain);
}
