import { sha256 } from "@noble/hashes/sha2";
import { utf8ToBytes, bytesToHex } from "@noble/hashes/utils";

export function hashSHA256(data: string) {
    return bytesToHex(sha256(utf8ToBytes(data)));
}
