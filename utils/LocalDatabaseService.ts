import * as FileSystem from 'expo-file-system';
import { sha256 } from './E2EEService';
import { Platform } from 'react-native';

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
                // ── messages table ───────────────────────────────────────────────
                // server_id UNIQUE NULL: multiple NULL rows are allowed by SQLite
                // (each NULL is distinct), but once a server_id is written it is
                // unique and permanent.  The ON CONFLICT clause in insertMessage
                // handles races between socket and polling.
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
                        timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                // Migration: Add key_version for rotation
                try {
                    await this.db.execute(`ALTER TABLE messages ADD COLUMN key_version INTEGER;`);
                } catch (e) { }

                // Migration: Add temp_id if it doesn't exist
                try {
                    await this.db.execute(`ALTER TABLE messages ADD COLUMN temp_id TEXT;`);
                } catch (e) { /* Ignore if column exists */ }

                // Migration: Add retry_count if it doesn't exist (for existing DBs)
                try {
                    await this.db.execute(`ALTER TABLE messages ADD COLUMN retry_count INTEGER DEFAULT 0;`);
                } catch (e) { /* Ignore if column exists */ }

                // Migration: Add deletion columns
                try {
                    await this.db.execute(`ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0;`);
                } catch (e) { }
                try {
                    await this.db.execute(`ALTER TABLE messages ADD COLUMN deleted_for_everyone INTEGER DEFAULT 0;`);
                } catch (e) { }
                try {
                    await this.db.execute(`ALTER TABLE messages ADD COLUMN deleted_at DATETIME;`);
                } catch (e) { }

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
                        unread_count        INTEGER DEFAULT 0
                    );
                `);

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

                // Search indexes
                await this.db.execute('CREATE INDEX IF NOT EXISTS idx_messages_text ON messages(encrypted_payload);');
                await this.db.execute('CREATE INDEX IF NOT EXISTS idx_messages_chat_time ON messages(chat_id, timestamp);');

                await this.db.execute(`
                    CREATE TABLE IF NOT EXISTS settings (
                        key TEXT PRIMARY KEY,
                        value TEXT
                    );
                `);

                this.isInitialized = true;
                this.isInitializing = false;
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

    // ─────────────────────────────────────────────────────────────────────────
    // insertMessage — THE safe insert used by BOTH socket handler and
    // fetchMessages.  Never throws on duplicate; instead:
    //   • If server_id already exists → UPDATE status & decrypt payload only
    //     (never overwrite a file path that is already set)
    //   • If server_id is NULL (optimistic / local-only) → plain INSERT
    //
    // This is the ONLY place that writes to the messages table for new rows.
    // ─────────────────────────────────────────────────────────────────────────
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
        timestamp?: string; // Optional: use server time if provided
        temp_id?: string;
        key_version?: number;
    }): Promise<number> {
        const db = this.getDB();

        try {
            let insertId = 0;
            const finalTimestamp = msg.timestamp || new Date().toISOString();

            // Path A — message has a real server_id (comes from server / socket)
            if (msg.server_id) {
                const result = await db.execute(
                    `INSERT INTO messages
                        (server_id, temp_id, chat_id, sender_id, receiver_id, type,
                         encrypted_payload, local_file_path, status, retry_count, key_version, timestamp)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                         timestamp         = COALESCE(excluded.timestamp, messages.timestamp)`,
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
                        finalTimestamp
                    ]
                );
                insertId = result.insertId || 0;
            } else {
                // Path B — optimistic / local message (no server_id yet)
                const result = await db.execute(
                    `INSERT INTO messages
                        (server_id, temp_id, chat_id, sender_id, receiver_id, type,
                         encrypted_payload, local_file_path, status, retry_count, key_version, timestamp)
                     VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                        finalTimestamp
                    ]
                );
                insertId = result.insertId || 0;
            }

            // AUTO-UPDATE CHATS TABLE
            // We only update last_message and time if the new message is newer than the existing one
            // OR if it's a new chat row.
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
                    0, // Default unread_count for new row
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

    // ─────────────────────────────────────────────────────────────────────────
    // updateServerId — called once after server confirms a temp message.
    // Guards against the race where socket + polling both try to claim the same
    // row: if the server_id is already taken, we DELETE the orphan temp row
    // instead of crashing on UNIQUE constraint.
    // ─────────────────────────────────────────────────────────────────────────
    static async updateServerId(local_id: number, server_id: string): Promise<void> {
        const db = this.getDB();
        try {
            // Check whether this server_id is already confirmed in another row
            const existing = await db.execute(
                `SELECT id FROM messages WHERE server_id = ? LIMIT 1`,
                [server_id]
            );

            if (existing.rows && existing.rows.length > 0) {
                // The server_id already belongs to a confirmed row.
                // The optimistic row (local_id) is now a duplicate → delete it.
                await db.execute(`DELETE FROM messages WHERE id = ? AND server_id IS NULL`, [local_id]);
                console.log(`[DB] updateServerId: server_id ${server_id} already confirmed. Removed orphan local row ${local_id}.`);
                return;
            }

            // Safe to assign the server_id to this optimistic row
            await db.execute(
                `UPDATE messages SET server_id = ? WHERE id = ?`,
                [server_id, local_id]
            );
        } catch (err: any) {
            if (err?.message?.includes('UNIQUE') || err?.message?.includes('constraint')) {
                // Race lost — delete the orphan temp row silently
                console.warn(`[DB] updateServerId: UNIQUE conflict for ${server_id}, removing orphan row ${local_id}.`);
                try { await db.execute(`DELETE FROM messages WHERE id = ? AND server_id IS NULL`, [local_id]); } catch (_) { }
                return;
            }
            console.error('[DB] updateServerId: error:', err);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getLocalMessages — returns messages ordered by timestamp DESC.
    // Supports pagination via limit and beforeTimestamp cursor.
    // ─────────────────────────────────────────────────────────────────────────
    static async getLocalMessages(chat_id: string, limit: number = 30, beforeTimestamp?: string): Promise<any[]> {
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

        query += ` ORDER BY timestamp DESC LIMIT ?`;
        params.push(limit);

        const result = await db.execute(query, params);
        return (result.rows || []) as any[];
    }

    static async updateMessageStatus(id: number, status: string): Promise<void> {
        const db = this.getDB();
        await db.execute(`UPDATE messages SET status = ? WHERE id = ?`, [status, id]);
    }

    static async updateMessageStatusAndRetry(id: number, status: string, retry_count: number): Promise<void> {
        const db = this.getDB();
        await db.execute(`UPDATE messages SET status = ?, retry_count = ? WHERE id = ?`, [status, retry_count, id]);
    }

    // ── Search Implementation ────────────────────────────────────────────────

    /**
     * Search messages inside a specific chat.
     */
    static async searchMessages(chatId: string, query: string, limit: number = 30, offset: number = 0): Promise<any[]> {
        const db = this.getDB();
        const result = await db.execute(
            `SELECT id, chat_id, sender_id, encrypted_payload, timestamp, type, status
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

    /**
     * Search messages across all chats (Global Search).
     * Includes chat metadata for display.
     */
    static async searchGlobalMessages(query: string, limit: number = 30, offset: number = 0): Promise<any[]> {
        const db = this.getDB();
        const result = await db.execute(
            `SELECT 
                m.id, m.chat_id, m.sender_id, m.encrypted_payload, m.timestamp, m.type, m.status,
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

    /**
     * Fetch messages from the latest down to (and including) a specific message ID.
     * Useful for jumping to a message from search.
     */
    static async getMessagesUpToId(chatId: string, messageId: number | string): Promise<any[]> {
        const db = this.getDB();

        // 1. Get the timestamp of the target message
        const targetRes = await db.execute(
            `SELECT timestamp FROM messages WHERE (id = ? OR server_id = ?) AND chat_id = ?`,
            [messageId, messageId, chatId]
        );

        if (!targetRes.rows || targetRes.rows.length === 0) return [];
        const targetTimestamp = targetRes.rows[0].timestamp;

        // 2. Fetch all messages newer than or equal to this timestamp
        // We add a small limit safety but usually it's fine
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
        // Return both 'failed' and 'pending' messages, ordered chronologically, with a retry limit
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

    // ── Status Retry Queue ───────────────────────────────────────────────────

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

    // ── Chat List Management ──────────────────────────────────────────────────

    static async getConversations(): Promise<any[]> {
        const db = this.getDB();
        // Use subquery to ensure we have the absolute latest status from messages
        // while sorting the chat list by message time.
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
            ORDER BY COALESCE(m.timestamp, c.last_message_time) DESC
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
    }): Promise<void> {
        const db = this.getDB();
        await db.execute(
            `INSERT INTO chats (
                id, is_group, other_user_id, other_username, other_avatar_url, 
                other_avatar_id, other_is_official, group_name, group_icon, unread_count
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                is_group          = excluded.is_group,
                other_user_id     = COALESCE(excluded.other_user_id, other_user_id),
                other_username    = COALESCE(excluded.other_username, other_username),
                other_avatar_url  = COALESCE(excluded.other_avatar_url, other_avatar_url),
                other_avatar_id   = COALESCE(excluded.other_avatar_id, other_avatar_id),
                other_is_official = COALESCE(excluded.other_is_official, other_is_official),
                group_name        = COALESCE(excluded.group_name, group_name),
                group_icon        = COALESCE(excluded.group_icon, group_icon),
                unread_count      = COALESCE(excluded.unread_count, unread_count)`,
            [
                chatData.id,
                chatData.is_group ? 1 : 0,
                chatData.other_user_id || null,
                chatData.other_username || null,
                chatData.other_avatar_url || null,
                chatData.other_avatar_id || null,
                chatData.other_is_official || 0,
                chatData.group_name || null,
                chatData.group_icon || null,
                chatData.unread_count || 0
            ]
        );
    }

    static async markChatRead(chatId: string): Promise<void> {
        const db = this.getDB();
        await db.execute(`UPDATE chats SET unread_count = 0 WHERE id = ?`, [chatId]);
        await db.execute(`UPDATE messages SET status = 'seen' WHERE chat_id = ? AND status != 'seen'`, [chatId]);
    }

    static async markAllMessagesSeen(chatId: string): Promise<void> {
        return this.markChatRead(chatId);
    }

    // ── Session Management ────────────────────────────────────────────────────

    /**
     * Safely closes the DB connection and resets internal state WITHOUT
     * touching any data. Call this on logout so the next initDB() call
     * (for the same or a different user) works cleanly.
     *
     * Messages, media file paths, and all table data are fully preserved.
     */
    static resetConnection(): void {
        try {
            if (this.db) {
                this.db.close();
            }
        } catch (_) {
            // Ignore close errors — the connection may already be stale
        } finally {
            this.db = null;
            this.isInitialized = false;
            this.isInitializing = false;
            this.initPromise = null;
            console.log('[LocalDatabaseService] DB connection reset (data preserved).');
        }
    }

    // ── Security ─────────────────────────────────────────────────────────────
    // NOTE: wipeDatabase() is intentionally kept for future "Delete Account"
    // use. It must NEVER be called on a normal logout.

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

    // ── Settings / Sync Time ──────────────────────────────────────────────────

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
}
