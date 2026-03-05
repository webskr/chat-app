import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { GCM } from "@stablelib/gcm";
import { AES } from "@stablelib/aes";
import { generateKeyPair as ecdhGenerate, createSharedSecret } from './crypto/ecdh';
import { encrypt as aesEncrypt, decrypt as aesDecrypt } from './crypto/aes';
import { secureRandomBytes } from './crypto/random';
import * as Crypto from 'expo-crypto';

export async function sha256(input: string): Promise<string> {
    const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        input,
        { encoding: Crypto.CryptoEncoding.HEX }
    );
    return hash.toLowerCase();
}

const KEY_ALIAS_PREFIX = 'vegram_e2e_';

export interface KeyPair {
    publicKey: string; // Base64
    privateKey: string; // Base64
}

export class E2EEService {

    /**
     * Generates a new ECDH Key Pair (secp256k1)
     */
    static async generateKeyPair(): Promise<KeyPair> {
        const { publicKey, privateKey } = await ecdhGenerate();
        return {
            publicKey: Buffer.from(publicKey).toString('base64'),
            privateKey: Buffer.from(privateKey).toString('base64'),
        };
    }

    /**
     * Derives a shared symmetric secret using ECDH
     */
    static deriveSharedSecret(myPrivateKeyBase64: string, theirPublicKeyBase64: string): Buffer {
        const myPriv = Buffer.from(myPrivateKeyBase64, 'base64');
        const theirPub = Buffer.from(theirPublicKeyBase64, 'base64');
        const sharedSecret = createSharedSecret(new Uint8Array(myPriv), new Uint8Array(theirPub));
        return Buffer.from(sharedSecret);
    }

    /**
     * Encrypts plaintext using AES-256-GCM and a shared secret
     */
    static async encryptMessage(plaintext: string, sharedSecret: Buffer): Promise<string> {
        const { iv, cipher } = await aesEncrypt(new Uint8Array(sharedSecret.slice(0, 32)), plaintext);

        // Stablelib seal appends the 16-byte tag to the ciphertext
        const tag = cipher.slice(-16);
        const actualCiphertext = cipher.slice(0, -16);

        // Format: nonce:authTag:ciphertext
        return `${Buffer.from(iv).toString('base64')}:${Buffer.from(tag).toString('base64')}:${Buffer.from(actualCiphertext).toString('base64')}`;
    }

    /**
     * Decrypts ciphertext using AES-256-GCM and a shared secret
     */
    static decryptMessage(encryptedPayload: string, sharedSecret: Buffer): string {
        const parts = encryptedPayload.split(':');
        if (parts.length !== 3) {
            throw new Error("Invalid encrypted payload format.");
        }

        const nonce = Buffer.from(parts[0], 'base64');
        const authTag = Buffer.from(parts[1], 'base64');
        const ciphertext = Buffer.from(parts[2], 'base64');

        // Stablelib open expects ciphertext + tag combined
        const combined = new Uint8Array(ciphertext.length + authTag.length);
        combined.set(new Uint8Array(ciphertext));
        combined.set(new Uint8Array(authTag), ciphertext.length);

        return aesDecrypt(new Uint8Array(sharedSecret.slice(0, 32)), new Uint8Array(nonce), combined);
    }

    /**
     * Saves a versioned private key to the device's SecureStore
     */
    static async savePrivateKey(userId: string, privateKey: string, version: number): Promise<void> {
        await SecureStore.setItemAsync(`${KEY_ALIAS_PREFIX}${userId}_priv_v${version}`, privateKey);
    }

    /**
     * Loads a specific version of a private key from SecureStore
     */
    static async loadPrivateKey(userId: string, version: number): Promise<string | null> {
        return await SecureStore.getItemAsync(`${KEY_ALIAS_PREFIX}${userId}_priv_v${version}`);
    }

    /**
     * Saves the current key version for the user
     */
    static async setCurrentKeyVersion(userId: string, version: number): Promise<void> {
        await SecureStore.setItemAsync(`${KEY_ALIAS_PREFIX}${userId}_current_v`, version.toString());
    }

    /**
     * Gets the current key version for the user
     */
    static async getCurrentKeyVersion(userId: string): Promise<number> {
        const v = await SecureStore.getItemAsync(`${KEY_ALIAS_PREFIX}${userId}_current_v`);
        return v ? parseInt(v) : 1;
    }

    /**
     * Records the last rotation time
     */
    static async setLastRotationTime(userId: string, timestamp: number): Promise<void> {
        await SecureStore.setItemAsync(`${KEY_ALIAS_PREFIX}${userId}_rotation_time`, timestamp.toString());
    }

    /**
     * Gets the last rotation time
     */
    static async getLastRotationTime(userId: string): Promise<number> {
        const t = await SecureStore.getItemAsync(`${KEY_ALIAS_PREFIX}${userId}_rotation_time`);
        return t ? parseInt(t) : 0;
    }

    /**
     * Checks if key rotation is needed (periodically, first login, etc.)
     */
    static async checkRotationNeeded(userId: string): Promise<boolean> {
        const lastRotation = await this.getLastRotationTime(userId);
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        // If never rotated or 30 days passed
        if (lastRotation === 0 || (Date.now() - lastRotation) > thirtyDaysMs) {
            return true;
        }
        return false;
    }

    /**
     * Generates and uploads a new key pair, incrementing the version.
     */
    static async rotateKeys(userId: string, Config: any): Promise<number> {
        console.log(`[E2EE] Rotating keys for user ${userId}...`);

        const currentVersion = await this.getCurrentKeyVersion(userId);
        const newVersion = currentVersion + 1;

        const newKeyPair = await this.generateKeyPair();

        // 1. Save locally
        await this.savePrivateKey(userId, newKeyPair.privateKey, newVersion);
        await this.setCurrentKeyVersion(userId, newVersion);
        await this.setLastRotationTime(userId, Date.now());

        // 2. Upload to server
        try {
            const response = await fetch(`${Config.API_URL}/chat/upload_rotated_key.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    key_version: newVersion,
                    public_key: newKeyPair.publicKey
                })
            });

            if (response.ok) {
                console.log(`[E2EE] Successfully rotated to version ${newVersion}`);
            } else {
                console.warn(`[E2EE] Key rotated locally but server upload failed. Status: ${response.status}`);
            }
        } catch (err) {
            console.error(`[E2EE] Key rotation server upload error:`, err);
        }

        return newVersion;
    }

    /**
     * Encrypts a local file before upload, returning the path to the encrypted blob and symmetric keys.
     */
    static async encryptFile(fileUri: string): Promise<{ encryptedUri: string, key: string, nonce: string, tag: string }> {
        const fileBase64 = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' as any });
        const fileData = Buffer.from(fileBase64, 'base64');

        const key = await secureRandomBytes(32);
        const nonce = await secureRandomBytes(12);

        const aes = new GCM(new AES(new Uint8Array(key)));
        const encrypted = aes.seal(nonce, new Uint8Array(fileData));

        const tag = encrypted.slice(-16);
        const ciphertext = encrypted.slice(0, -16);

        const tempUri = ((FileSystem as any).cacheDirectory || 'file:///') + 'encrypted_' + Date.now() + '.enc';
        await FileSystem.writeAsStringAsync(tempUri, Buffer.from(ciphertext).toString('base64'), { encoding: 'base64' as any });

        return {
            encryptedUri: tempUri,
            key: Buffer.from(key).toString('base64'),
            nonce: Buffer.from(nonce).toString('base64'),
            tag: Buffer.from(tag).toString('base64')
        };
    }

    /**
     * Decrypts a downloaded encrypted file and saves it to the strictly secure Android Media directory.
     */
    static async decryptFile(encryptedUri: string, keyBase64: string, nonceBase64: string, tagBase64: string, mimeType: string): Promise<string> {
        const ciphertextBase64 = await FileSystem.readAsStringAsync(encryptedUri, { encoding: 'base64' as any });
        const ciphertext = Buffer.from(ciphertextBase64, 'base64');
        const key = Buffer.from(keyBase64, 'base64');
        const nonce = Buffer.from(nonceBase64, 'base64');
        const tag = Buffer.from(tagBase64, 'base64');

        const aes = new GCM(new AES(new Uint8Array(key)));
        const combined = new Uint8Array(ciphertext.length + tag.length);
        combined.set(new Uint8Array(ciphertext));
        combined.set(new Uint8Array(tag), ciphertext.length);

        const decrypted = aes.open(new Uint8Array(nonce), combined);
        if (!decrypted) throw new Error("File decryption failed");

        // Determine extension
        let ext = '.bin';
        if (mimeType.includes('image/jpeg')) ext = '.jpg';
        else if (mimeType.includes('image/png')) ext = '.png';
        else if (mimeType.includes('video/mp4')) ext = '.mp4';
        else if (mimeType.includes('audio/')) ext = '.m4a';
        else if (mimeType.includes('gif')) ext = '.gif';

        const baseDir = (FileSystem as any).documentDirectory || 'file:///';
        const mediaDir = baseDir + 'Media/';
        const dirInfo = await FileSystem.getInfoAsync(mediaDir);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true });
        }

        const finalUri = mediaDir + 'MEDIA_' + Date.now() + ext;
        await FileSystem.writeAsStringAsync(finalUri, Buffer.from(decrypted).toString('base64'), { encoding: 'base64' as any });

        return finalUri;
    }
}
