# Real-time Chat Notification System Documentation

This document explains the logic behind the "Smart Notification System" that prevents push notifications from being sent when a user is actively viewing a chat. 

## 1. Core Logic Overview

The main objective of the system is to ensure users do not receive annoying push notifications for a chat they are already actively reading. 

The logic follows these rules:
1. **User is Offline:** Send a push notification immediately.
2. **User is Online, but in a DIFFERENT chat/screen:** Send an in-app socket event (`notification:inapp`). If the app doesn't acknowledge receipt within 1 second, send a push notification.
3. **User is Online AND currently viewing the SAME chat:** **NO** push notification is sent. The message arrives silently via real-time sockets.

---

## 2. Key Files & Their Roles

### `backend/socket/server.js` (The Brain)
This is where the core presence and room-tracking logic lives.

- **State Management (`userStates` Map):** 
  The server maintains an in-memory mapped object of all connected users and their sockets.
  ```javascript
  userStates = { 
    userId: { 
      sockets: { 
        socketId: { activeChatId: "chat_123" } 
      }, 
      pendingPushes: Map() 
    } 
  }
  ```
  *Why a Map of sockets?* A user might have Vegram open on multiple devices (e.g., phone and web). We track the `activeChatId` for *each* socket.

- **Socket Events for Tracking:**
  - `user:identify`: Links a user's ID to their socket when they connect.
  - `chat_open`: The client tells the server "I am now looking at chat ID 123". The server updates `activeChatId`.
  - `chat_close`: The client tells the server "I left the chat screen". The server sets `activeChatId` to `null`.

- **Message Processing (`message:new` event):**
  1. Relays the message to the socket room immediately so the sender and receiver see it instantly.
  2. **Race Condition Delay:** It waits `500ms` before deciding whether to send a notification. This prevents a bug where the user clicks a push notification, opens the chat, but a new message arrives *just* before the socket registers the `chat_open` event.
  3. **Same-Chat Check (`isInSameChat`):** It loops through all of the receiver's active sockets. If *any* socket has `activeChatId` equal to the incoming message's chat room ID, `isInSameChat` evaluates to `true`, and the notification logic is aborted `return;`.
  4. **Acknowledgment (`message:received`):** If not in the same chat, it sends `notification:inapp` and waits. If the client replies with `message:received` (ACK) within 1000ms, the push is cancelled.

### `app/chat/[id].tsx` (Frontend Presence Emitters)
The frontend chat screen interacts with the socket server to notify it about the user's focus.
- When the screen mounts (user opens the chat), it emits `socket.emit("chat_open", { chatId: ... })`.
- When the screen unmounts (user goes back), it emits `socket.emit("chat_close")`.

### `backend/users/update_online_status.php` (Database Sync)
The socket server automatically calls this PHP file behind the scenes to sync the user's overall online status to the MySQL database. 
- When the *first* socket connects -> Sets user `is_online = 1`.
- When the *last* socket disconnects -> Sets user `is_online = 0` and updates `last_active`.

---

## 3. Database Migrations (DB Changes)

To support this presence system globally (so API files know if a user is online without querying the Node server), the `users` table in your MySQL database required specific columns.

**Migrations Applied / Required Columns in `users` table:**
1. **`is_online`** (`TINYINT(1)` or `BOOLEAN`, default `0`)
   - **Use:** Acts as a global flag to show a green dot on the UI for online users.
2. **`last_active`** (`DATETIME` or `TIMESTAMP`)
   - **Use:** Stores the exact time the user's socket disconnected. Used to show "Last seen at X" when `is_online` is 0.
3. **`last_typing`** (`DATETIME` or `TIMESTAMP`, optional based on typing indicator logic)
   - **Use:** Records the timestamp when the user was last typing.

### Migration SQL Query Reference:
If these weren't added before, the SQL would look like:
```sql
ALTER TABLE users 
ADD COLUMN is_online TINYINT(1) DEFAULT 0,
ADD COLUMN last_active DATETIME NULL,
ADD COLUMN last_typing DATETIME NULL;
```

---

## 4. Flow Summary

1. User A sends message to User B.
2. Node Server (`server.js`) receives `message:new`.
3. Server checks `userStates[User B]`.
4. Does User B have any socket where `activeChatId == User A's Chat ID`?
   - **YES:** Stop. Do nothing. Message is already on their screen.
   - **NO (But they are online):** Send in-app notification header. Wait 1 second for ACK. If no ACK, send Firebase Push.
   - **NO (They are completely offline):** Send Firebase Push immediately.
