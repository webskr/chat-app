import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';
import { generateKeyPair as ecdhGenerate, createSharedSecret } from './crypto/ecdh';
import { encrypt as aesEncrypt, decrypt as aesDecrypt } from './crypto/aes';
import { secureRandomBytes } from './crypto/random';
import { GCM } from "@stablelib/gcm";
import { AES } from "@stablelib/aes";

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
     * Saves the private key to the device's SecureStore
     */
    static async savePrivateKey(userId: string, keyPair: KeyPair): Promise<void> {
        await SecureStore.setItemAsync(`${KEY_ALIAS_PREFIX}${userId}_priv`, keyPair.privateKey);
        await SecureStore.setItemAsync(`${KEY_ALIAS_PREFIX}${userId}_pub`, keyPair.publicKey);
    }

    /**
     * Loads the private key from SecureStore
     */
    static async loadPrivateKey(userId: string): Promise<string | null> {
        return await SecureStore.getItemAsync(`${KEY_ALIAS_PREFIX}${userId}_priv`);
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
