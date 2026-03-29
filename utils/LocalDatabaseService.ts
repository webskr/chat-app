import * as FileSystem from 'expo-file-system';
import { sha256 } from './E2EEService';
import { Platform } from 'react-native';
import { parseToDate } from './time';

let opSqlite: any = null;
if (Platform.OS !== 'web') {
    try {
        opSqlite = require('@op-engineering/op-sqlite');
    } catch (e) {
        console.warn("[LocalDatabaseService] op-sqlite module not found. Use a development build.");
    }
}

export class LocalDatabaseService {
    private static db: any = null;
    private static isInitialized = false;
    private static isInitializing = false;
    private static initPromise: Promise<void> | null = null;
    private static DB_FILENAME = 'vegram_encrypted.sqlite';
    public static activeChatId: string | null = null;
    public static currentUserId: string | null = null;

    private static async deleteDatabase() {
        const sqliteDir = `${FileSystem.documentDirectory}SQLite/`;
        const path = sqliteDir + this.DB_FILENAME;
        try {
            const info = await FileSystem.getInfoAsync(path);
            if (info.exists) {
                await FileSystem.deleteAsync(path, { idempotent: true });
                console.log("[LocalDatabaseService] Database file deleted for recovery.");
            }
        } catch (e) {
            console.error("[LocalDatabaseService] Failed to delete database file:", e);
        }
    }

    static async initDB(userSessionToken: string): Promise<void> {
        if (this.isInitialized && this.db) return;
        if (this.isInitializing) return;
        if (this.initPromise) return this.initPromise;

        this.isInitializing = true;
        console.log("[LocalDatabaseService] --- INIT DB START ---");

        this.initPromise = (async () => {
            if (Platform.OS === 'web') {
                console.warn("[LocalDatabaseService] Database not supported on Web. Using no-op.");
                this.isInitialized = true;
                return;
            }

            if (!opSqlite) {
                const msg = "[LocalDatabaseService] Cannot initialize DB: op-sqlite native module missing. Use a development build.";
                console.error(msg);
                throw new Error(msg);
            }

            try {
                // 1. Derive persistent device ID
                let deviceId = 'fallbackDeviceID_vegram';
                try {
                    const idFile = `${FileSystem.documentDirectory}vegram_device_id`;
                    const storedDeviceId = await FileSystem.readAsStringAsync(idFile).catch(() => null);
                    if (storedDeviceId && storedDeviceId.length > 5) {
                        deviceId = storedDeviceId;
                    } else {
                        deviceId = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
                        await FileSystem.writeAsStringAsync(idFile, deviceId).catch(() => { });
                    }
                } catch (e) {
                    console.error("[LocalDatabaseService] Failed to handle persistent deviceId:", e);
                }

                const safeToken = String(userSessionToken || 'guest');
                const dataToHash = safeToken + deviceId;

                // 2. Derive encryption key
                let encryptionKey: string;
                try {
                    encryptionKey = "v1_" + await sha256(dataToHash);
                } catch (hashError) {
                    console.error("[LocalDatabaseService] Hash failed:", hashError);
                    encryptionKey = "v1_emergency_fallback_key_persistent";
                }

                // 3. Open DB with SQLCipher key
                const openAndValidate = async () => {
                    this.db = opSqlite.open({
                        name: this.DB_FILENAME,
                        encryptionKey: encryptionKey
                    });
                    try {
                        await this.db.execute("PRAGMA user_version;");
                        console.log("[LocalDatabaseService] Database validated successfully.");
                    } catch (e) {
                        console.warn("[LocalDatabaseService] Key validation failed.");
                        throw e;
                    }
                };

                try {
                    await openAndValidate();
                } catch (openError) {
                    console.warn("[LocalDatabaseService] Invalid key or corrupted DB. Attempting recovery...");
                    try {
                        if (this.db) { try { this.db.close(); } catch (e) { } this.db = null; }
                        await this.deleteDatabase();
                        await openAndValidate();
                        console.log("[LocalDatabaseService] DB successfully recreated.");
                    } catch (recoveryError) {
                        console.error("[LocalDatabaseService] CRITICAL: DB Recovery failed:", recoveryError);
                        throw recoveryError;
                    }
                }

                // 4. Create / migrate schema
                await this.db.execute(`
                    CREATE TABLE IF NOT EXISTS messages (
                        id              INTEGER PRIMARY KEY AUTOINCREMENT,
                        server_id       TEXT UNIQUE,
                        temp_id         TEXT,
                        chat_id         TEXT NOT NULL,
                        sender_id       TEXT NOT NULL,
                        receiver_id     TEXT,
                        type            TEXT NOT NULL,
                        encrypted_payload TEXT,
                        local_file_path TEXT,
                        status          TEXT NOT NULL DEFAULT 'sending',
                        retry_count     INTEGER DEFAULT 0,
                        is_deleted      INTEGER DEFAULT 0,
                        deleted_for_everyone INTEGER DEFAULT 0,
                        deleted_at      DATETIME,
                        timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP,
                        sender_name     TEXT,
                        is_one_time     INTEGER DEFAULT 0,
                        key_version     INTEGER,
                        sender_is_official INTEGER DEFAULT 0,
                        reactions       TEXT
                    );
                `);

                // Migration helpers
                try { await this.db.execute(`ALTER TABLE messages ADD COLUMN key_version INTEGER;`); } catch (e) { }
                try { await this.db.execute(`ALTER TABLE messages ADD COLUMN temp_id TEXT;`); } catch (e) { }
                try { await this.db.execute(`ALTER TABLE messages ADD COLUMN retry_count INTEGER DEFAULT 0;`); } catch (e) { }
                try { await this.db.execute(`ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0;`); } catch (e) { }
                try { await this.db.execute(`ALTER TABLE messages ADD COLUMN deleted_for_everyone INTEGER DEFAULT 0;`); } catch (e) { }
                try { await this.db.execute(`ALTER TABLE messages ADD COLUMN deleted_at DATETIME;`); } catch (e) { }
                try { await this.db.execute(`ALTER TABLE messages ADD COLUMN sender_name TEXT;`); } catch (e) { }
                try { await this.db.execute(`ALTER TABLE messages ADD COLUMN is_one_time INTEGER DEFAULT 0;`); } catch (e) { }
                try { await this.db.execute(`ALTER TABLE messages ADD COLUMN sender_is_official INTEGER DEFAULT 0;`); } catch (e) { }
                try { await this.db.execute(`ALTER TABLE messages ADD COLUMN reactions TEXT;`); } catch (e) { }

                await this.db.execute(`
                    CREATE TABLE IF NOT EXISTS chats (
                        id                  TEXT PRIMARY KEY,
                        is_group            INTEGER DEFAULT 0,
                        other_user_id       TEXT,
                        other_username      TEXT,
                        other_avatar_url    TEXT,
                        other_avatar_id     INTEGER,
                        other_is_official   INTEGER DEFAULT 0,
                        group_name          TEXT,
                        group_icon          TEXT,
                        last_message        TEXT,
                        last_message_time   DATETIME,
                        last_message_sender TEXT,
                        unread_count        INTEGER DEFAULT 0,
                        auto_delete_minutes INTEGER DEFAULT 0,
                        is_favourite        INTEGER DEFAULT 0,
                        is_pinned           INTEGER DEFAULT 0,
                        is_muted            INTEGER DEFAULT 0,
                        is_locked           INTEGER DEFAULT 0
                    );
                `);

                try { await this.db.execute(`ALTER TABLE chats ADD COLUMN auto_delete_minutes INTEGER DEFAULT 0;`); } catch (e) { }
                try { await this.db.execute(`ALTER TABLE chats ADD COLUMN is_favourite INTEGER DEFAULT 0;`); } catch (e) { }
                try { await this.db.execute(`ALTER TABLE chats ADD COLUMN is_pinned INTEGER DEFAULT 0;`); } catch (e) { }
                try { await this.db.execute(`ALTER TABLE chats ADD COLUMN is_muted INTEGER DEFAULT 0;`); } catch (e) { }
                try { await this.db.execute(`ALTER TABLE chats ADD COLUMN is_locked INTEGER DEFAULT 0;`); } catch (e) { }

                await this.db.execute(`
                    CREATE TABLE IF NOT EXISTS status_retry_queue (
                        id         INTEGER PRIMARY KEY AUTOINCREMENT,
                        server_id  TEXT NOT NULL,
                        chat_id    TEXT NOT NULL,
                        status     TEXT NOT NULL,
                        timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                await this.db.execute('CREATE INDEX IF NOT EXISTS idx_chat_id  ON messages(chat_id);');
                await this.db.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);');
                await this.db.execute('CREATE INDEX IF NOT EXISTS idx_server_id ON messages(server_id);');
                await this.db.execute('CREATE INDEX IF NOT EXISTS idx_chats_last_time ON chats(last_message_time);');
                await this.db.execute('CREATE INDEX IF NOT EXISTS idx_messages_text ON messages(encrypted_payload);');
                await this.db.execute('CREATE INDEX IF NOT EXISTS idx_messages_chat_time ON messages(chat_id, timestamp);');

                await this.db.execute(`
                    CREATE TABLE IF NOT EXISTS settings (
                        key TEXT PRIMARY KEY,
                        value TEXT
                    );
                `);

                // CLEANUP: Fix group duplication
                try {
                    await this.db.execute(`DELETE FROM chats WHERE id LIKE 'group_%'`);
                    await this.db.execute(`UPDATE messages SET chat_id = REPLACE(chat_id, 'group_', '') WHERE chat_id LIKE 'group_%'`);
                } catch (cleanupErr) { }

                this.isInitialized = true;
                this.isInitializing = false;
                this.currentUserId = String(userSessionToken);
                console.log("[LocalDatabaseService] --- INIT DB COMPLETE ---");
            } catch (dbError) {
                this.isInitializing = false;
                this.initPromise = null;
                console.error("[LocalDatabaseService] CRITICAL: Failed to initialize DB:", dbError);
                throw dbError;
            }
        })();

        return this.initPromise;
    }

    static isReady(): boolean { return this.isInitialized; }

    static getDB(): any {
        if (Platform.OS === 'web') {
            return { execute: async () => ({ rows: [], insertId: 0 }) };
        }
        if (!this.db || !this.isInitialized) {
            throw new Error("LocalDatabaseService must be initialized with initDB(token) first.");
        }
        return this.db;
    }

    static getDBPath(): string {
        const sqliteDir = `${FileSystem.documentDirectory}SQLite/`;
        return sqliteDir + this.DB_FILENAME;
    }

    static async closeDB(): Promise<void> {
        if (this.db) {
            try {
                this.db.close();
                this.db = null;
                this.isInitialized = false;
                this.initPromise = null;
            } catch (e) {
                console.error("[LocalDatabaseService] Error closing DB:", e);
            }
        }
    }

    static async insertMessage(msg: {
        server_id?: string;
        chat_id: string;
        sender_id: string;
        receiver_id?: string;
        type: string;
        encrypted_payload?: string;
        local_file_path?: string;
        status: string;
        retry_count?: number;
        timestamp?: string;
        temp_id?: string;
        key_version?: number;
        sender_name?: string;
        sender_is_official?: number | boolean;
        is_one_time?: boolean | number;
        reactions?: string | any[];
    }): Promise<number> {
        const db = this.getDB();

        try {
            let insertId = 0;
            const finalTimestamp = parseToDate(msg.timestamp || new Date()).toISOString();

            if (msg.server_id) {
                const result = await db.execute(
                    `INSERT INTO messages
                        (server_id, temp_id, chat_id, sender_id, receiver_id, type,
                         encrypted_payload, local_file_path, status, retry_count, key_version, timestamp, sender_name, sender_is_official, is_one_time, reactions)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(server_id) DO UPDATE SET
                         status            = CASE
                                                WHEN messages.status = 'seen' THEN 'seen'
                                                WHEN excluded.status = 'seen' THEN 'seen'
                                                ELSE excluded.status
                                            END,
                         encrypted_payload = COALESCE(messages.encrypted_payload, excluded.encrypted_payload),
                         local_file_path   = COALESCE(messages.local_file_path,   excluded.local_file_path),
                         retry_count       = excluded.retry_count,
                         key_version       = COALESCE(messages.key_version, excluded.key_version),
                         timestamp         = COALESCE(excluded.timestamp, messages.timestamp),
                         sender_name       = COALESCE(excluded.sender_name, messages.sender_name),
                         sender_is_official = COALESCE(excluded.sender_is_official, messages.sender_is_official),
                         is_one_time       = COALESCE(messages.is_one_time, excluded.is_one_time),
                         reactions         = COALESCE(excluded.reactions, messages.reactions)`,
                    [
                        msg.server_id,
                        msg.temp_id || null,
                        msg.chat_id,
                        msg.sender_id,
                        msg.receiver_id || null,
                        msg.type,
                        msg.encrypted_payload || null,
                        msg.local_file_path || null,
                        msg.status,
                        msg.retry_count || 0,
                        msg.key_version || null,
                        finalTimestamp,
                        msg.sender_name || null,
                        (msg.sender_is_official === true || msg.sender_is_official === 1 || String(msg.sender_is_official) === '1') ? 1 : 0,
                        (msg.is_one_time === true || msg.is_one_time === 1 || String(msg.is_one_time) === 'true' || String(msg.is_one_time) === '1') ? 1 : 0,
                        msg.reactions ? (typeof msg.reactions === 'string' ? msg.reactions : JSON.stringify(msg.reactions)) : null
                    ]
                );
                insertId = result.insertId || 0;
            } else {
                const result = await db.execute(
                    `INSERT INTO messages
                        (server_id, temp_id, chat_id, sender_id, receiver_id, type,
                         encrypted_payload, local_file_path, status, retry_count, key_version, timestamp, sender_name, sender_is_official, is_one_time, reactions)
                     VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        msg.temp_id || null,
                        msg.chat_id,
                        msg.sender_id,
                        msg.receiver_id || null,
                        msg.type,
                        msg.encrypted_payload || null,
                        msg.local_file_path || null,
                        msg.status,
                        msg.retry_count || 0,
                        msg.key_version || null,
                        finalTimestamp,
                        msg.sender_name || null,
                        (msg.sender_is_official === true || msg.sender_is_official === 1 || String(msg.sender_is_official) === '1') ? 1 : 0,
                        (msg.is_one_time === true || msg.is_one_time === 1 || String(msg.is_one_time) === 'true' || String(msg.is_one_time) === '1') ? 1 : 0,
                        msg.reactions ? (typeof msg.reactions === 'string' ? msg.reactions : JSON.stringify(msg.reactions)) : null
                    ]
                );
                insertId = result.insertId || 0;
            }

            await db.execute(
                `INSERT INTO chats (id, last_message, last_message_time, last_message_sender, unread_count)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                    last_message        = CASE 
                                            WHEN excluded.last_message_time >= chats.last_message_time OR chats.last_message_time IS NULL 
                                            THEN excluded.last_message 
                                            ELSE chats.last_message 
                                          END,
                    last_message_time   = CASE 
                                            WHEN excluded.last_message_time >= chats.last_message_time OR chats.last_message_time IS NULL 
                                            THEN excluded.last_message_time 
                                            ELSE chats.last_message_time 
                                          END,
                    last_message_sender = CASE 
                                            WHEN excluded.last_message_time >= chats.last_message_time OR chats.last_message_time IS NULL 
                                            THEN excluded.last_message_sender 
                                            ELSE chats.last_message_sender 
                                          END,
                    unread_count        = CASE
                                            WHEN excluded.last_message_sender != chats.other_user_id THEN chats.unread_count
                                            WHEN ? = chats.id THEN 0
                                            WHEN excluded.last_message_time > chats.last_message_time OR chats.last_message_time IS NULL THEN chats.unread_count + 1
                                            ELSE chats.unread_count
                                          END`,
                [
                    msg.chat_id,
                    msg.encrypted_payload || (msg.type === 'image' ? '📷 Image' : (msg.type === 'video' ? '🎥 Video' : '📎 Attachment')),
                    finalTimestamp,
                    msg.sender_id,
                    0,
                    this.activeChatId || 'NONE'
                ]
            );

            return insertId;

        } catch (err: any) {
            if (err?.message?.includes('UNIQUE') || err?.message?.includes('constraint')) {
                console.warn('[DB] insertMessage: swallowed UNIQUE conflict for server_id:', msg.server_id);
                return 0;
            }
            console.error('[DB] insertMessage: unexpected error:', err);
            throw err;
        }
    }

    static async updateServerId(local_id: number, server_id: string): Promise<void> {
        const db = this.getDB();
        try {
            const existing = await db.execute(
                `SELECT id FROM messages WHERE server_id = ? LIMIT 1`,
                [server_id]
            );
            if (existing.rows && existing.rows.length > 0) {
                await db.execute(`DELETE FROM messages WHERE id = ? AND server_id IS NULL`, [local_id]);
                console.log(`[DB] updateServerId: server_id ${server_id} already confirmed. Removed orphan local row ${local_id}.`);
                return;
            }
            await db.execute(`UPDATE messages SET server_id = ? WHERE id = ?`, [server_id, local_id]);
        } catch (err: any) {
            if (err?.message?.includes('UNIQUE') || err?.message?.includes('constraint')) {
                console.warn(`[DB] updateServerId: UNIQUE conflict for ${server_id}, removing orphan row ${local_id}.`);
                try { await db.execute(`DELETE FROM messages WHERE id = ? AND server_id IS NULL`, [local_id]); } catch (_) { }
                return;
            }
            console.error('[DB] updateServerId: error:', err);
        }
    }

    static async getLocalMessages(chat_id: string, limit: number = 30, beforeTimestamp?: string, cutoffTimestamp?: string): Promise<any[]> {
        const db = this.getDB();
        let query = `SELECT * FROM messages 
                     WHERE chat_id = ? 
                       AND is_deleted = 0
                       AND (server_id IS NOT NULL OR encrypted_payload IS NOT NULL OR local_file_path IS NOT NULL)`;
        const params: any[] = [chat_id];
        if (beforeTimestamp) {
            query += ` AND timestamp < ?`;
            params.push(beforeTimestamp);
        }
        if (cutoffTimestamp) {
            query += ` AND timestamp >= ?`;
            params.push(cutoffTimestamp);
        }
        query += ` ORDER BY timestamp DESC LIMIT ?`;
        params.push(limit);
        const result = await db.execute(query, params);
        return (result.rows || []) as any[];
    }

    static async getChatMedia(chat_id: string, limit: number = 30, cutoffTimestamp?: string): Promise<any[]> {
        const db = this.getDB();
        let query = `SELECT * FROM messages 
             WHERE chat_id = ? 
               AND (
                   type IN ('image', 'video', 'document', 'link') 
                   OR (type = 'text' AND (encrypted_payload LIKE '%http%' OR encrypted_payload LIKE '%www.%' OR encrypted_payload LIKE '%.com%' OR encrypted_payload LIKE '%.net%'))
               )
               AND is_deleted = 0`;
        const params: any[] = [chat_id];
        if (cutoffTimestamp) {
            query += ` AND timestamp >= ?`;
            params.push(cutoffTimestamp);
        }
        query += ` ORDER BY timestamp DESC LIMIT ?`;
        params.push(limit);
        const result = await db.execute(query, params);
        return (result.rows || []) as any[];
    }

    static async updateMessageStatus(id: number, status: string): Promise<void> {
        const db = this.getDB();
        if (status === 'seen') {
            await db.execute(
                `UPDATE messages 
                 SET status = ?, 
                     local_file_path = CASE WHEN is_one_time = 1 THEN NULL ELSE local_file_path END,
                     encrypted_payload = CASE WHEN is_one_time = 1 THEN NULL ELSE encrypted_payload END
                 WHERE id = ?`, 
                [status, id]
            );
        } else {
            await db.execute(`UPDATE messages SET status = ? WHERE id = ?`, [status, id]);
        }
    }

    static async updateMessageStatusAndRetry(id: number, status: string, retry_count: number): Promise<void> {
        const db = this.getDB();
        await db.execute(`UPDATE messages SET status = ?, retry_count = ? WHERE id = ?`, [status, retry_count, id]);
    }

    static async searchMessages(chatId: string, query: string, limit: number = 30, offset: number = 0): Promise<any[]> {
        const db = this.getDB();
        const result = await db.execute(
            `SELECT id, chat_id, sender_id, sender_name, encrypted_payload, timestamp, type, status
             FROM messages
             WHERE chat_id = ? 
               AND type = 'text'
               AND is_deleted = 0
               AND encrypted_payload LIKE '%' || ? || '%'
             ORDER BY timestamp DESC
             LIMIT ? OFFSET ?`,
            [chatId, query, limit, offset]
        );
        return (result.rows || []) as any[];
    }

    static async searchGlobalMessages(query: string, limit: number = 30, offset: number = 0): Promise<any[]> {
        const db = this.getDB();
        const result = await db.execute(
            `SELECT 
                m.id, m.chat_id, m.sender_id, m.sender_name, m.encrypted_payload, m.timestamp, m.type, m.status,
                c.other_username, c.group_name, c.other_avatar_url, c.group_icon, c.is_group,
                c.other_avatar_id, c.other_is_official
            FROM messages m
            JOIN chats c ON m.chat_id = c.id
            WHERE m.type = 'text'
              AND m.is_deleted = 0
              AND m.encrypted_payload LIKE '%' || ? || '%'
            ORDER BY m.timestamp DESC
            LIMIT ? OFFSET ?`,
            [query, limit, offset]
        );
        return (result.rows || []) as any[];
    }

    static async getMessagesUpToId(chatId: string, messageId: number | string): Promise<any[]> {
        const db = this.getDB();
        const targetRes = await db.execute(
            `SELECT timestamp FROM messages WHERE (id = ? OR server_id = ?) AND chat_id = ?`,
            [messageId, messageId, chatId]
        );
        if (!targetRes.rows || targetRes.rows.length === 0) return [];
        const targetTimestamp = targetRes.rows[0].timestamp;
        const result = await db.execute(
            `SELECT * FROM messages 
             WHERE chat_id = ? 
               AND is_deleted = 0
               AND timestamp >= ?
             ORDER BY timestamp DESC
             LIMIT 200`,
            [chatId, targetTimestamp]
        );
        return (result.rows || []) as any[];
    }

    static async markMessagesSeenLocally(messageIds: (string | number)[]): Promise<void> {
        if (messageIds.length === 0) return;
        const db = this.getDB();
        const placeholders = messageIds.map(() => '?').join(',');
        await db.execute(
            `UPDATE messages SET status = 'seen' WHERE server_id IN (${placeholders}) AND status != 'seen'`,
            messageIds.map(id => id.toString())
        );
    }

    static async getFailedMessages(): Promise<any[]> {
        const db = this.getDB();
        const result = await db.execute(
            `SELECT * FROM messages 
             WHERE (status = 'failed' OR status = 'pending') 
               AND retry_count < 5 
             ORDER BY timestamp ASC`
        );
        return (result.rows || []) as any[];
    }

    static async updateMessageMediaUrl(server_id: string, local_file_path: string): Promise<void> {
        const db = this.getDB();
        await db.execute(
            `UPDATE messages SET local_file_path = ? WHERE server_id = ?`,
            [local_file_path, server_id]
        );
    }

    static async deleteMessageLocal(local_id: number): Promise<void> {
        const db = this.getDB();
        await db.execute(`UPDATE messages SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, [local_id]);
    }

    static async markMessageDeletedForMe(local_id: number): Promise<void> {
        return this.deleteMessageLocal(local_id);
    }

    static async markMessageDeletedForEveryone(server_id: string): Promise<void> {
        const db = this.getDB();
        await db.execute(
            `UPDATE messages
             SET deleted_for_everyone = 1, 
                 encrypted_payload = '🚫 This message was deleted', 
                 local_file_path = NULL,
                 deleted_at = CURRENT_TIMESTAMP
             WHERE server_id = ?`,
            [server_id]
        );
    }

    static async purgeOldMessages(chat_id: string, minutes: number): Promise<void> {
        if (!this.db || !this.isInitialized || minutes <= 0) return;
        const db = this.getDB();
        
        try {
            // 1. Get media paths for files to be deleted
            const mediaRes = await db.execute(
                `SELECT local_file_path FROM messages 
                 WHERE chat_id = ? 
                 AND timestamp < DATETIME('now', '-' || ? || ' minutes')
                 AND local_file_path IS NOT NULL`,
                [chat_id, minutes]
            );

            if (mediaRes.rows && mediaRes.rows.length > 0) {
                for (const row of mediaRes.rows) {
                    if (row.local_file_path) {
                        try {
                            // Only delete if it's within the app's document directory
                            if (row.local_file_path.includes(FileSystem.documentDirectory || '')) {
                                const info = await FileSystem.getInfoAsync(row.local_file_path);
                                if (info.exists) {
                                    await FileSystem.deleteAsync(row.local_file_path, { idempotent: true });
                                }
                            }
                        } catch (e) {
                            console.warn(`[DB] Failed to delete media file ${row.local_file_path}:`, e);
                        }
                    }
                }
            }

            // 2. Hard delete the messages
            await db.execute(
                `DELETE FROM messages 
                 WHERE chat_id = ? 
                 AND timestamp < DATETIME('now', '-' || ? || ' minutes')`,
                [chat_id, minutes]
            );

            console.log(`[DB] Purged messages older than ${minutes} minutes for chat ${chat_id}.`);
        } catch (error) {
            console.error('[DB] purgeOldMessages failed:', error);
        }
    }

    static async queueStatusUpdate(server_id: string, chat_id: string, status: string): Promise<void> {
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

    static async deleteQueuedStatusUpdate(id: number): Promise<void> {
        const db = this.getDB();
        await db.execute(`DELETE FROM status_retry_queue WHERE id = ?`, [id]);
    }

    static async getLastServerId(chat_id: string): Promise<string | null> {
        const db = this.getDB();
        const result = await db.execute(
            `SELECT server_id FROM messages
             WHERE chat_id = ? AND server_id IS NOT NULL
             ORDER BY timestamp DESC LIMIT 1`,
            [chat_id]
        );
        return (result.rows?.[0] as any)?.server_id || null;
    }

    static async getConversations(): Promise<any[]> {
        const db = this.getDB();
        const result = await db.execute(`
            SELECT 
                c.*, 
                m.encrypted_payload as last_message_preview,
                m.timestamp as last_message_time_real
            FROM chats c
            LEFT JOIN messages m ON m.id = (
                SELECT id FROM messages 
                WHERE chat_id = c.id 
                ORDER BY timestamp DESC 
                LIMIT 1
            )
            ORDER BY c.is_pinned DESC, COALESCE(m.timestamp, c.last_message_time) DESC
        `);
        return (result.rows || []) as any[];
    }

    static async updateChatMetadata(chatData: {
        id: string;
        is_group: boolean;
        other_user_id?: string;
        other_username?: string;
        other_avatar_url?: string;
        other_avatar_id?: number;
        other_is_official?: number;
        group_name?: string;
        group_icon?: string;
        unread_count?: number;
        auto_delete_minutes?: number;
        is_favourite?: number;
        is_pinned?: number;
        is_muted?: number;
        is_locked?: number;
    }): Promise<void> {
        const db = this.getDB();
        await db.execute(
            `INSERT INTO chats (
                id, is_group, other_user_id, other_username, other_avatar_url, 
                other_avatar_id, other_is_official, group_name, group_icon, unread_count,
                auto_delete_minutes, is_favourite, is_pinned, is_muted, is_locked
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                is_group          = excluded.is_group,
                other_user_id     = COALESCE(excluded.other_user_id, chats.other_user_id),
                other_username    = COALESCE(excluded.other_username, chats.other_username),
                other_avatar_url  = COALESCE(excluded.other_avatar_url, chats.other_avatar_url),
                other_avatar_id   = COALESCE(excluded.other_avatar_id, chats.other_avatar_id),
                other_is_official = CASE 
                                        WHEN excluded.other_is_official = 1 THEN 1 
                                        WHEN chats.other_is_official = 1 THEN 1 
                                        ELSE COALESCE(excluded.other_is_official, chats.other_is_official, 0) 
                                    END,
                group_name        = COALESCE(excluded.group_name, chats.group_name),
                group_icon        = COALESCE(excluded.group_icon, chats.group_icon),
                unread_count      = COALESCE(excluded.unread_count, chats.unread_count),
                auto_delete_minutes = COALESCE(excluded.auto_delete_minutes, chats.auto_delete_minutes),
                is_favourite      = COALESCE(excluded.is_favourite, chats.is_favourite),
                is_pinned         = COALESCE(excluded.is_pinned, chats.is_pinned),
                is_muted          = COALESCE(excluded.is_muted, chats.is_muted),
                is_locked         = COALESCE(excluded.is_locked, chats.is_locked)`,
            [
                chatData.id,
                chatData.is_group ? 1 : 0,
                chatData.other_user_id ?? null,
                chatData.other_username ?? null,
                chatData.other_avatar_url ?? null,
                chatData.other_avatar_id ?? null,
                chatData.other_is_official ?? null,
                chatData.group_name ?? null,
                chatData.group_icon ?? null,
                chatData.unread_count ?? null,
                chatData.auto_delete_minutes ?? null,
                chatData.is_favourite ?? 0,
                chatData.is_pinned ?? 0,
                chatData.is_muted ?? 0,
                chatData.is_locked ?? 0
            ]
        );
    }

    static async toggleFavourite(chatId: string, isFavourite: boolean): Promise<void> {
        const db = this.getDB();
        await db.execute(
            `UPDATE chats SET is_favourite = ? WHERE id = ?`,
            [isFavourite ? 1 : 0, chatId]
        );
    }

    static async batchUpdateChats(chatIds: string[], updates: { [key: string]: any }): Promise<void> {
        if (chatIds.length === 0) return;
        const db = this.getDB();
        const assignments = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const placeholders = chatIds.map(() => '?').join(', ');
        const values = [...Object.values(updates), ...chatIds];
        
        await db.execute(
            `UPDATE chats SET ${assignments} WHERE id IN (${placeholders})`,
            values
        );
    }

    static async batchDeleteChats(chatIds: string[]): Promise<void> {
        if (chatIds.length === 0) return;
        const db = this.getDB();
        const placeholders = chatIds.map(() => '?').join(', ');
        
        // 1. Delete messages
        await db.execute(`DELETE FROM messages WHERE chat_id IN (${placeholders})`, chatIds);
        // 2. Delete chats
        await db.execute(`DELETE FROM chats WHERE id IN (${placeholders})`, chatIds);
    }

    static async batchClearChats(chatIds: string[]): Promise<void> {
        if (chatIds.length === 0) return;
        const db = this.getDB();
        const placeholders = chatIds.map(() => '?').join(', ');
        
        // 1. Delete messages
        await db.execute(`DELETE FROM messages WHERE chat_id IN (${placeholders})`, chatIds);
        // 2. Clear last message metadata in chats
        await db.execute(
            `UPDATE chats SET last_message = NULL, last_message_time = NULL, unread_count = 0 
             WHERE id IN (${placeholders})`,
            chatIds
        );
    }

    static async ensureSelfChat(userId: string): Promise<void> {
        if (!this.isInitialized) return;
        const db = this.getDB();
        const chatId = `chat_${userId}_${userId}`;
        try {
            await db.execute(
                `INSERT INTO chats (id, is_group, other_user_id, other_username, unread_count)
                 VALUES (?, 0, ?, 'Note to self', 0)
                 ON CONFLICT(id) DO NOTHING`,
                [chatId, userId]
            );
        } catch (e) {
            console.error("[DB] ensureSelfChat failed:", e);
        }
    }

    static async deleteChatByOtherUserId(otherUserId: string): Promise<void> {
        if (this.currentUserId && String(otherUserId) === String(this.currentUserId)) {
            console.log("[DB] Guard: Prevented deletion of self-chat.");
            return;
        }
        const db = this.getDB();
        // 1. Find the chat ID(s) involving this user in 1-on-1 contexts
        const result = await db.execute(
            `SELECT id FROM chats WHERE other_user_id = ? AND is_group = 0`,
            [otherUserId]
        );
        const chatIds = (result.rows || []).map((row: any) => row.id);

        for (const chatId of chatIds) {
            // 2. Delete messages for this chat
            await db.execute(`DELETE FROM messages WHERE chat_id = ?`, [chatId]);
            // 3. Delete the chat itself
            await db.execute(`DELETE FROM chats WHERE id = ?`, [chatId]);
            console.log(`[DB] Purged local chat ${chatId} for blocked user ${otherUserId}`);
        }
    }

    static async markChatRead(chatId: string, currentUserId?: string | number): Promise<void> {
        const db = this.getDB();
        await db.execute(`UPDATE chats SET unread_count = 0 WHERE id = ?`, [chatId]);
        
        if (currentUserId) {
            // Only mark messages sent TO me as seen
            await db.execute(
                `UPDATE messages SET status = 'seen' WHERE chat_id = ? AND receiver_id = ? AND status != 'seen'`, 
                [chatId, currentUserId.toString()]
            );
        } else {
            // Fallback for legacy calls (less safe)
            await db.execute(`UPDATE messages SET status = 'seen' WHERE chat_id = ? AND status != 'seen'`, [chatId]);
        }
    }

    static async markAllMessagesSeen(chatId: string, currentUserId?: string | number): Promise<void> {
        return this.markChatRead(chatId, currentUserId);
    }

    static resetConnection(): void {
        try {
            if (this.db) {
                this.db.close();
            }
        } catch (_) {
        } finally {
            this.db = null;
            this.isInitialized = false;
            this.isInitializing = false;
            this.initPromise = null;
            console.log('[LocalDatabaseService] DB connection reset (data preserved).');
        }
    }

    static async wipeDatabase(): Promise<void> {
        if (!this.db || !this.isInitialized) return;
        try {
            await this.db.execute(`DROP TABLE IF EXISTS messages;`);
            await this.db.execute(`DROP TABLE IF EXISTS status_retry_queue;`);
            this.db.close();
            this.db = null;
            this.isInitialized = false;
            this.isInitializing = false;
            this.initPromise = null;
            console.log("[Security] Encrypted local database wiped and closed.");
        } catch (e) {
            console.error("[Security] Failed to wipe encrypted database:", e);
        }
    }

    static async getLastSyncTime(): Promise<string> {
        const db = this.getDB();
        try {
            const result = await db.execute(`SELECT value FROM settings WHERE key = 'last_sync_time' LIMIT 1`);
            if (result.rows && result.rows.length > 0) {
                return result.rows[0].value;
            }
        } catch (e) {
            console.error("[DB] Failed to get last_sync_time:", e);
        }
        return '2000-01-01 00:00:00';
    }

    static async updateLastSyncTime(time?: string): Promise<void> {
        const db = this.getDB();
        const syncTime = time || new Date().toISOString().replace('T', ' ').split('.')[0];
        try {
            await db.execute(
                `INSERT INTO settings (key, value) VALUES ('last_sync_time', ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
                [syncTime]
            );
        } catch (e) {
             console.error("[DB] Failed to update last_sync_time:", e);
        }
    }

    static async cleanupExpiredMessages(): Promise<void> {
        if (!this.isInitialized) return;
        const db = this.getDB();
        try {
            console.log("[LocalDatabaseService] 🧹 Running local auto-delete cleanup...");
            const result = await db.execute(`
                DELETE FROM messages
                WHERE chat_id IN (
                    SELECT id FROM chats WHERE auto_delete_minutes > 0
                )
                AND timestamp < DATETIME('now', '-' || (
                    SELECT auto_delete_minutes FROM chats WHERE chats.id = messages.chat_id
                ) || ' minutes')
            `);
            if (result.rowsAffected > 0) {
                console.log(`[LocalDatabaseService] 🗑️ Purged ${result.rowsAffected} expired messages locally.`);
            }
        } catch (e) {
            console.error("[LocalDatabaseService] Cleanup error:", e);
        }
    }
}
