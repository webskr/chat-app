import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import { Platform } from 'react-native';
import { LocalDatabaseService } from './LocalDatabaseService';
import { E2EEService } from './E2EEService';
import { deriveKey } from '@stablelib/pbkdf2';
import { SHA256 } from '@stablelib/sha256';
import { AES } from '@stablelib/aes';
import { GCM } from '@stablelib/gcm';
import JSZip from 'jszip';

import { getPublicMediaDirectory, writeMedia } from '../modules/vegram-media';

export class BackupService {
    private static getBaseDir() {
        const publicDir = getPublicMediaDirectory();
        if (publicDir) return publicDir;
        // Fallback for Expo Go
        return `${FileSystem.documentDirectory?.replace('files/', 'media/')}com.skr.vegram/`;
    }

    private static get BACKUP_DIR() { return `${this.getBaseDir()}backups/`; }
    private static get MEDIA_DIR() { return `${this.getBaseDir()}media/`; }
    private static get TEMP_BACKUP_DIR() { return `${FileSystem.cacheDirectory}backup_temp/`; }

    /**
     * Creates a full encrypted backup locally.
     */
    static async createBackup(password: string, userId: string): Promise<string> {
        console.log("[BackupService] Starting backup process...");
        try {
            // 1. Prepare temp directory
            await this.prepareTempDir();

            // 2. Export Databases
            await this.exportDatabases();

            // 3. Export Media
            await this.exportMedia();

            // 4. Export Encryption Keys
            await this.exportKeys(password, userId);

            // 5. Create Metadata
            await this.createMetadata(userId);

            // 6. ZIP Package (Placeholder for now)
            const zipPath = await this.packageBackup();

            // 7. Cleanup
            await this.cleanupTemp();

            return zipPath;
        } catch (error) {
            console.error("[BackupService] Backup failed:", error);
            throw error;
        }
    }

    /**
     * Restores data from a backup ZIP file.
     */
    static async restoreBackup(zipUri: string, password: string): Promise<void> {
        console.log("[BackupService] Starting restore process...");
        try {
            // 1. Prepare temp directory
            await this.prepareTempDir();

            // 2. Extract ZIP to temp
            await this.unpackageBackup(zipUri);

            // 3. Validate Metadata
            const metadata = await this.readMetadata();
            console.log("[BackupService] Metadata validated for user:", metadata.user_id);

            // 4. Decrypt and Restore Keys
            await this.restoreKeys(password, metadata.user_id);

            // 5. Restore Databases
            await this.restoreDatabases();

            // 6. Restore Media
            await this.restoreMedia();

            // 7. Cleanup
            await this.cleanupTemp();

            console.log("[BackupService] Restore complete! Restart required.");
        } catch (error) {
            console.error("[BackupService] Restore failed:", error);
            throw error;
        }
    }

    private static async prepareTempDir() {
        const info = await FileSystem.getInfoAsync(this.TEMP_BACKUP_DIR);
        if (info.exists) {
            await FileSystem.deleteAsync(this.TEMP_BACKUP_DIR, { idempotent: true });
        }
        await FileSystem.makeDirectoryAsync(this.TEMP_BACKUP_DIR, { intermediates: true });
        await FileSystem.makeDirectoryAsync(`${this.TEMP_BACKUP_DIR}db/`, { intermediates: true });
        await FileSystem.makeDirectoryAsync(`${this.TEMP_BACKUP_DIR}media/`, { intermediates: true });
        await FileSystem.makeDirectoryAsync(`${this.TEMP_BACKUP_DIR}keys/`, { intermediates: true });
    }

    private static async exportDatabases() {
        console.log("[BackupService] Exporting databases...");
        const dbPath = LocalDatabaseService.getDBPath();
        const destPath = `${this.TEMP_BACKUP_DIR}db/messages.db`;

        // 1. Flush/Close DB to ensure file is consistent
        // We'll need the user token to re-init after backup, but for now we just close it
        await LocalDatabaseService.closeDB();

        // 2. Copy the file
        let actualDBPath = dbPath;
        const info = await FileSystem.getInfoAsync(dbPath);

        if (!info.exists && Platform.OS === 'android') {
            // op-sqlite on Android often stores databases in /databases/ instead of /files/SQLite/
            // documentDirectory is /files/
            const databasesPath = dbPath.replace('/files/SQLite/', '/databases/');
            const dbInfo = await FileSystem.getInfoAsync(databasesPath);
            if (dbInfo.exists) {
                actualDBPath = databasesPath;
                console.log("[BackupService] Found database in alternative path:", actualDBPath);
            }
        }

        const finalInfo = await FileSystem.getInfoAsync(actualDBPath);
        if (finalInfo.exists) {
            await FileSystem.copyAsync({ from: actualDBPath, to: destPath });
            console.log("[BackupService] Database exported to temp.");
        } else {
            console.warn("[BackupService] Database file not found even at alternative paths.");
        }
    }

    private static async exportMedia() {
        console.log("[BackupService] Exporting media...");
        const info = await FileSystem.getInfoAsync(this.MEDIA_DIR);
        if (!info.exists) {
            console.log("[BackupService] No media directory found, skipping.");
            return;
        }

        const files = await FileSystem.readDirectoryAsync(this.MEDIA_DIR);
        for (const file of files) {
            const from = `${this.MEDIA_DIR}${file}`;
            const to = `${this.TEMP_BACKUP_DIR}media/${file}`;

            const fileInfo = await FileSystem.getInfoAsync(from);
            if (!fileInfo.isDirectory) {
                await FileSystem.copyAsync({ from, to }).catch(e => {
                    console.warn(`[BackupService] Failed to copy media ${file}:`, e);
                });
            }
        }
        console.log(`[BackupService] Exported ${files.length} items from media.`);
    }

    private static async exportKeys(password: string, userId: string) {
        console.log("[BackupService] Exporting keys...");
        const currentVersion = await E2EEService.getCurrentKeyVersion(userId);
        const keysToExport: Record<string, string> = {};

        // Collect all private keys
        for (let v = 1; v <= currentVersion; v++) {
            const key = await E2EEService.loadPrivateKey(userId, v);
            if (key) {
                keysToExport[`v${v}`] = key;
            }
        }

        // Use Crypto instead of deprecated Random
        const salt = await Crypto.getRandomBytesAsync(16);
        const derivedKey = await this.deriveKey(password, salt);

        // Encrypt the JSON bundle
        const plaintext = JSON.stringify(keysToExport);
        const { iv, cipher } = await this.encryptData(plaintext, derivedKey);

        const result = {
            salt: Buffer.from(salt).toString('base64'),
            iv: Buffer.from(iv).toString('base64'),
            cipher: Buffer.from(cipher).toString('base64'),
            userId
        };

        await FileSystem.writeAsStringAsync(`${this.TEMP_BACKUP_DIR}keys/encrypted_keys.json`, JSON.stringify(result, null, 2));
        console.log("[BackupService] Keys exported and encrypted.");
    }

    private static async deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
        // @stablelib/pbkdf2 exports deriveKey as a function
        return deriveKey(SHA256, new Uint8Array(Buffer.from(password)), salt, 10000, 32);
    }

    private static async encryptData(plaintext: string, key: Uint8Array): Promise<{ iv: Uint8Array, cipher: Uint8Array }> {
        const iv = await Crypto.getRandomBytesAsync(12);
        const aes = new GCM(new AES(key));
        const cipher = aes.seal(iv, new Uint8Array(Buffer.from(plaintext)));
        return { iv, cipher };
    }

    private static async createMetadata(userId: string) {
        console.log("[BackupService] Creating metadata...");
        const metadata = {
            backup_version: 1,
            user_id: userId,
            created_at: new Date().toISOString(),
            app_version: "1.0.0"
        };
        await FileSystem.writeAsStringAsync(`${this.TEMP_BACKUP_DIR}metadata.json`, JSON.stringify(metadata, null, 2));
    }

    private static async packageBackup(): Promise<string> {
        console.log("[BackupService] Packaging backup (ZIP)...");
        const zip = new JSZip();

        // Recursively add files to ZIP
        await this.addFolderToZip(zip, this.TEMP_BACKUP_DIR, "");

        const content = await zip.generateAsync({ type: 'base64' });
        const fileName = `backup_${new Date().toISOString().replace(/[:.]/g, '').split('T')[0]}.zip`;
        const backupDir = this.BACKUP_DIR;

        // Ensure backup directory exists
        const dirInfo = await FileSystem.getInfoAsync(backupDir);
        if (!dirInfo.exists) {
            console.log("[BackupService] Creating backup directory:", backupDir);
            await FileSystem.makeDirectoryAsync(backupDir, { intermediates: true });
        }

        const finalPath = `${backupDir}${fileName}`;

        if (Platform.OS === 'android') {
            console.log("[BackupService] Using native write for ZIP package on Android.");
            await writeMedia(content, fileName, "backups");
        } else {
            await FileSystem.writeAsStringAsync(finalPath, content, { encoding: FileSystem.EncodingType.Base64 });
        }

        console.log("[BackupService] ZIP package created at:", finalPath);
        return finalPath;
    }

    private static async addFolderToZip(zip: any, currentDir: string, zipPath: string) {
        const items = await FileSystem.readDirectoryAsync(currentDir);
        for (const item of items) {
            const uri = `${currentDir}${item}`;
            const info = await FileSystem.getInfoAsync(uri);
            if (info.isDirectory) {
                await this.addFolderToZip(zip.folder(item), `${uri}/`, `${zipPath}${item}/`);
            } else {
                const content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                zip.file(item, content, { base64: true });
            }
        }
    }

    private static async cleanupTemp() {
        await FileSystem.deleteAsync(this.TEMP_BACKUP_DIR, { idempotent: true });
    }

    private static async unpackageBackup(zipUri: string) {
        console.log("[BackupService] Unpackaging backup...");
        const base64 = await FileSystem.readAsStringAsync(zipUri, { encoding: FileSystem.EncodingType.Base64 });
        const zip = await JSZip.loadAsync(base64, { base64: true });

        for (const [relativePath, file] of Object.entries(zip.files)) {
            if (!(file as any).dir) {
                const content = await (file as any).async('base64');
                const dest = `${this.TEMP_BACKUP_DIR}${relativePath}`;

                // Ensure parent directory exists
                const parentDir = dest.substring(0, dest.lastIndexOf('/'));
                await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true }).catch(() => { });

                await FileSystem.writeAsStringAsync(dest, content, { encoding: FileSystem.EncodingType.Base64 });
            }
        }
    }

    private static async readMetadata(): Promise<any> {
        const content = await FileSystem.readAsStringAsync(`${this.TEMP_BACKUP_DIR}metadata.json`);
        return JSON.parse(content);
    }

    private static async restoreKeys(password: string, userId: string) {
        console.log("[BackupService] Restoring keys...");
        const content = await FileSystem.readAsStringAsync(`${this.TEMP_BACKUP_DIR}keys/encrypted_keys.json`);
        const { salt, iv, cipher } = JSON.parse(content);

        const derivedKey = await this.deriveKey(password, Buffer.from(salt, 'base64'));
        const decryptedPlaintext = await this.decryptData(Buffer.from(iv, 'base64'), Buffer.from(cipher, 'base64'), derivedKey);

        const keys: Record<string, string> = JSON.parse(decryptedPlaintext);

        // Save to SecureStore
        let maxVersion = 0;
        for (const [versionStr, key] of Object.entries(keys)) {
            const version = parseInt(versionStr.replace('v', ''));
            await E2EEService.savePrivateKey(userId, key, version);
            if (version > maxVersion) maxVersion = version;
        }
        await E2EEService.setCurrentKeyVersion(userId, maxVersion);
        console.log(`[BackupService] Restored ${Object.keys(keys).length} keys. Current version: ${maxVersion}`);
    }

    private static async decryptData(iv: Uint8Array, cipher: Uint8Array, key: Uint8Array): Promise<string> {
        const aes = new GCM(new AES(key));
        const decrypted = aes.open(iv, cipher);
        if (!decrypted) throw new Error("Key decryption failed. Wrong password?");
        return Buffer.from(decrypted).toString();
    }

    private static async restoreDatabases() {
        console.log("[BackupService] Restoring databases...");
        const srcPath = `${this.TEMP_BACKUP_DIR}db/messages.db`;
        const destPath = LocalDatabaseService.getDBPath();

        // 1. Close current DB
        await LocalDatabaseService.closeDB();

        // 2. Replace DB file
        let actualDestPath = destPath;
        if (Platform.OS === 'android') {
            const databasesPath = destPath.replace('/files/SQLite/', '/databases/');
            // Ensure databases directory exists
            const dbDir = databasesPath.substring(0, databasesPath.lastIndexOf('/'));
            await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true }).catch(() => { });
            actualDestPath = databasesPath;
        }

        await FileSystem.copyAsync({ from: srcPath, to: actualDestPath });
        console.log("[BackupService] Database restored to:", actualDestPath);
    }

    private static async restoreMedia() {
        console.log("[BackupService] Restoring media...");
        const tempMediaDir = `${this.TEMP_BACKUP_DIR}media/`;
        const files = await FileSystem.readDirectoryAsync(tempMediaDir).catch(() => []);

        for (const file of files) {
            const from = `${tempMediaDir}${file}`;
            const to = `${this.MEDIA_DIR}${file}`;
            await FileSystem.copyAsync({ from, to }).catch(e => {
                console.warn(`[BackupService] Failed to restore media ${file}:`, e);
            });
        }
        console.log(`[BackupService] Restored ${files.length} items to media.`);
    }

    /**
     * Deletes all local backup files.
     */
    static async deleteBackups(): Promise<void> {
        console.log("[BackupService] Deleting all local backups...");
        const exists = await FileSystem.getInfoAsync(this.BACKUP_DIR);
        if (exists.exists) {
            await FileSystem.deleteAsync(this.BACKUP_DIR, { idempotent: true });
            await FileSystem.makeDirectoryAsync(this.BACKUP_DIR, { intermediates: true });
        }
    }
}
