import QuickCrypto from 'react-native-quick-crypto';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';

const KEY_ALIAS_PREFIX = 'vegram_e2e_';

export interface KeyPair {
    publicKey: string; // Base64
    privateKey: string; // Base64
}

export class E2EEService {

    /**
     * Generates a new ECDH Key Pair (X25519)
     */
    static generateKeyPair(): KeyPair {
        const { publicKey, privateKey } = QuickCrypto.generateKeyPairSync('x25519', {
            publicKeyEncoding: { type: 'spki', format: 'der' },
            privateKeyEncoding: { type: 'pkcs8', format: 'der' },
        });

        return {
            publicKey: (publicKey as any).toString('base64'),
            privateKey: (privateKey as any).toString('base64'),
        };
    }

    /**
     * Derives a shared symmetric secret using ECDH
     */
    static deriveSharedSecret(myPrivateKeyBase64: string, theirPublicKeyBase64: string): Buffer {
        const sharedSecret = QuickCrypto.diffieHellman(
            Buffer.from(myPrivateKeyBase64, 'base64') as any,
            Buffer.from(theirPublicKeyBase64, 'base64') as any
        );
        return sharedSecret as any;
    }

    /**
     * Encrypts plaintext using AES-256-GCM and a shared secret
     */
    static encryptMessage(plaintext: string, sharedSecret: Buffer): string {
        const nonce = QuickCrypto.randomBytes(12); // 96-bit nonce for GCM
        const cipher = QuickCrypto.createCipheriv('aes-256-gcm', sharedSecret.slice(0, 32), nonce); // GCM requires 256-bit key

        let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
        ciphertext += cipher.final('base64');
        const authTag = cipher.getAuthTag();

        // Format: nonce:authTag:ciphertext
        return `${nonce.toString('base64')}:${authTag.toString('base64')}:${ciphertext}`;
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
        const ciphertext = parts[2];

        const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', sharedSecret.slice(0, 32), nonce);
        decipher.setAuthTag(authTag as any);

        let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
        plaintext += decipher.final('utf8');

        return plaintext;
    }

    /**
     * Saves the private key to the device's SecureStore
     */
    static async savePrivateKey(userId: string, keyPair: KeyPair): Promise<void> {
        await SecureStore.setItemAsync(`${KEY_ALIAS_PREFIX}${userId}_priv`, keyPair.privateKey);
        // Let's cache the public key too for convenience
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

        const key = QuickCrypto.randomBytes(32);
        const nonce = QuickCrypto.randomBytes(12);
        const cipher = QuickCrypto.createCipheriv('aes-256-gcm', key, nonce);

        // Encrypt the base64 content bridging back and forth
        let encryptedBase64 = cipher.update(fileBase64, 'base64', 'base64');
        encryptedBase64 += cipher.final('base64');
        const authTag = cipher.getAuthTag();

        const tempUri = ((FileSystem as any).cacheDirectory || 'file:///') + 'encrypted_' + Date.now() + '.enc';
        await FileSystem.writeAsStringAsync(tempUri, encryptedBase64, { encoding: 'base64' as any });

        return {
            encryptedUri: tempUri,
            key: key.toString('base64'),
            nonce: nonce.toString('base64'),
            tag: authTag.toString('base64')
        };
    }

    /**
     * Decrypts a downloaded encrypted file and saves it to the strictly secure Android Media directory.
     */
    static async decryptFile(encryptedUri: string, keyBase64: string, nonceBase64: string, tagBase64: string, mimeType: string): Promise<string> {
        const encryptedBase64 = await FileSystem.readAsStringAsync(encryptedUri, { encoding: 'base64' as any });
        const key = Buffer.from(keyBase64, 'base64');
        const nonce = Buffer.from(nonceBase64, 'base64');
        const authTag = Buffer.from(tagBase64, 'base64');

        const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', key, nonce);
        decipher.setAuthTag(authTag as any);

        let decryptedBase64 = decipher.update(encryptedBase64, 'base64', 'base64');
        decryptedBase64 += decipher.final('base64');

        // Determine extension
        let ext = '.bin';
        if (mimeType.includes('image/jpeg')) ext = '.jpg';
        else if (mimeType.includes('image/png')) ext = '.png';
        else if (mimeType.includes('video/mp4')) ext = '.mp4';
        else if (mimeType.includes('audio/')) ext = '.m4a';
        else if (mimeType.includes('gif')) ext = '.gif';

        // Save directly to the strictly secured Document Sandbox
        const baseDir = (FileSystem as any).documentDirectory || 'file:///';
        const mediaDir = baseDir + 'Media/';
        const dirInfo = await FileSystem.getInfoAsync(mediaDir);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true });
        }

        const finalUri = mediaDir + 'MEDIA_' + Date.now() + ext;
        await FileSystem.writeAsStringAsync(finalUri, decryptedBase64, { encoding: 'base64' as any });

        return finalUri;
    }
}
