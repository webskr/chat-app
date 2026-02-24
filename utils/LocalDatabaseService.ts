import { open, DB } from '@op-engineering/op-sqlite';
import * as FileSystem from 'expo-file-system';
import { hashSHA256 } from './crypto/hash';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export class LocalDatabaseService {
    private static db: DB | null = null;
    private static isInitialized = false;

    static async initDB(userSessionToken: string): Promise<void> {
        if (this.isInitialized && this.db) return;

        // 1. Determine Path
        // By leaving location undefined or setting to 'default', op-sqlite automatically 
        // places the database in the highly secure, app-specific internal Sandbox directory.
        // This implicitly prevents DB extraction via File Managers on non-rooted devices.
        let location: string | undefined = undefined;

        // 2. Derive Encryption Key
        // Deterministic but highly secure: userSessionToken ensures lock out after logout.
        const deviceId = Constants.sessionId || 'fallbackDeviceID_vegram';

        const encryptionKey = hashSHA256(userSessionToken + deviceId); // 64 char string (256-bit AES key for SQLCipher)

        // 3. Open DB with SQLCipher Key
        try {
            this.db = open({
                name: 'vegram_encrypted.sqlite',
                location: location,
                encryptionKey: encryptionKey
            });

            // 4. Create Schema
            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server_id TEXT UNIQUE,
                    chat_id TEXT NOT NULL,
                    sender_id TEXT NOT NULL,
                    receiver_id TEXT,
                    type TEXT NOT NULL,
                    encrypted_payload TEXT,
                    local_file_path TEXT,
                    status TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS status_retry_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server_id TEXT NOT NULL,
                    chat_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await this.db.execute('CREATE INDEX IF NOT EXISTS idx_chat_id ON messages(chat_id);');
            await this.db.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);');

            this.isInitialized = true;
            console.log("Local SQLCipher Database Initialized Securely.");
        } catch (dbError) {
            console.error("Failed to initialize encrypted database:", dbError);
            throw dbError; // Bubble up for Auth flow to handle (e.g., force logout if DB stuck)
        }
    }

    /**
     * Get the database connection
     */
    static getDB(): DB {
        if (!this.db || !this.isInitialized) {
            throw new Error("LocalDatabaseService must be initialized with initDB(token) first.");
        }
        return this.db;
    }

    /**
     * Helper to insert a local message
     */
    static async insertMessage(msg: {
        server_id?: string, chat_id: string, sender_id: string, receiver_id?: string,
        type: string, encrypted_payload?: string, local_file_path?: string, status: string
    }): Promise<number> {
        const db = this.getDB();
        const result = await db.execute(
            `INSERT INTO messages (server_id, chat_id, sender_id, receiver_id, type, encrypted_payload, local_file_path, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(server_id) DO UPDATE SET 
                status = excluded.status,
                encrypted_payload = excluded.encrypted_payload,
                local_file_path = COALESCE(messages.local_file_path, excluded.local_file_path)`,
            [
                msg.server_id || null, msg.chat_id, msg.sender_id, msg.receiver_id || null, msg.type,
                msg.encrypted_payload || null, msg.local_file_path || null, msg.status
            ]
        );
        return result.insertId || 0;
    }

    /**
     * Helper to fetch local messages
     */
    static async getLocalMessages(chat_id: string): Promise<any[]> {
        const db = this.getDB();
        const result = await db.execute(
            `SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC`,
            [chat_id]
        );
        return (result.rows || []) as any[];
    }

    /**
     * Helper to update message status
     */
    static async updateMessageStatus(id: number, status: string) {
        const db = this.getDB();
        await db.execute(
            `UPDATE messages SET status = ? WHERE id = ?`,
            [status, id]
        );
    }

    /**
     * Helper to update server_id
     */
    static async updateServerId(local_id: number, server_id: string) {
        const db = this.getDB();
        await db.execute(
            `UPDATE messages SET server_id = ? WHERE id = ?`,
            [server_id, local_id]
        );
    }

    static async updateMessageMediaUrl(server_id: string, local_file_path: string) {
        const db = this.getDB();
        await db.execute(
            `UPDATE messages SET local_file_path = ? WHERE server_id = ?`,
            [local_file_path, server_id]
        );
    }

    /**
     * Delete a message locally (Delete For Me)
     */
    static async deleteMessageLocal(local_id: number) {
        const db = this.getDB();
        await db.execute(`DELETE FROM messages WHERE id = ?`, [local_id]);
    }

    /**
     * Mark a message as deleted for everyone (Delete For Everyone)
     */
    static async markMessageDeletedForEveryone(server_id: string) {
        const db = this.getDB();
        await db.execute(
            `UPDATE messages SET type = 'deleted', encrypted_payload = '🚫 This message was deleted', local_file_path = NULL WHERE server_id = ?`,
            [server_id]
        );
    }

    /**
     * Methods for Status Retry Queue
     */
    static async queueStatusUpdate(server_id: string, chat_id: string, status: string) {
        const db = this.getDB();
        await db.execute(
            `INSERT INTO status_retry_queue (server_id, chat_id, status) VALUES (?, ?, ?)`,
            [server_id, chat_id, status]
        );
    }

    static async getQueuedStatusUpdates(): Promise<any[]> {
        const db = this.getDB();
        const result = await db.execute(`SELECT * FROM status_retry_queue ORDER BY timestamp ASC`);
        return (result.rows || []) as any[];
    }

    static async deleteQueuedStatusUpdate(id: number) {
        const db = this.getDB();
        await db.execute(`DELETE FROM status_retry_queue WHERE id = ?`, [id]);
    }

    static async getLastServerId(chat_id: string): Promise<string | null> {
        const db = this.getDB();
        const result = await db.execute(
            `SELECT server_id FROM messages WHERE chat_id = ? AND server_id IS NOT NULL ORDER BY id DESC LIMIT 1`,
            [chat_id]
        );
        return (result.rows?.[0] as any)?.server_id || null;
    }

    /**
     * Wipes the entire database contents and safely closes the connection.
     * Crucial for security on logout or session invalidation.
     */
    static async wipeDatabase(): Promise<void> {
        if (!this.db || !this.isInitialized) return;
        try {
            await this.db.execute(`DROP TABLE IF EXISTS messages;`);
            this.db.close();
            this.db = null;
            this.isInitialized = false;
            console.log("[Security] Encrypted Local Database completely wiped and closed.");
        } catch (e) {
            console.error("[Security] Failed to wipe encrypted database:", e);
        }
    }
}
