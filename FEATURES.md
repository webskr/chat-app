# Vegram Chat App Features

A comprehensive list of features implemented in the Vegram Chat Application, covering backend, frontend, and UI/UX details.

## 💬 Core Messaging
- **Real-time Chat:** One-on-one messaging system with auto-refresh (3s interval).
- **Text Messaging:** Support for sending and receiving long text messages (up to 5000 chars).
- **Multimedia Sharing:** Share images from gallery with backend storage and optimized delivery.
- **Message Status Tracking:** 
    - `Sending`: Initial state during upload/request.
    - `Delivered`: Message reached the server/other user's device (single check).
    - `Seen`: Message read by the recipient (double blue check).
- **Message Deletion:**
    - `Delete for Me`: Removes the message from your view only.
    - `Delete for Everyone`: Soft-deletes the message for all participants, replacing content with a placeholder.
- **Clear Chat:** Option to wipe the entire message history with a specific contact from the database.
- **Copy to Clipboard:** Long-press to copy message text.

## 😄 Reactions & Input
- **Message Reactions:** React to any message with a variety of emojis (Heart, Thumbs Up, Laugh, etc.).
- **Emoji Picker:** Built-in emoji selector for quick access during typing.
- **Attachment Menu:** Clean horizontal row for attachments (Images, etc.).
- **Intelligent Typing:** Auto-reset input after sending; handles multi-line text input gracefully.

## 👤 User & Social
- **Authentication:** Secure login and session management (UserContext).
- **Profile Customization:**
    - Edit Username and Bio.
    - Select from a variety of pre-defined themed Avatars.
- **Online Presence:** Real-time "Last Seen" tracking and online status indicators.
- **Relationship Management:**
    - Send and accept friend requests.
    - Unfriend/Remove contacts.
- **Privacy & Security:**
    - **Block/Unblock:** Prevent unwanted users from messaging you.
    - **Report User:** Flag inappropriate behavior with reasons sent to the admin.
- **Profile Modal:** View a contact's profile, bio, and relationship status directly from the chat screen.

## ⚙️ Advanced Settings & Controls
- **Auto-Delete Messages:** Global setting to automatically purge messages after a set duration (10 min to 90 days).
- **Mute Notifications:** Silence specific chat alerts for 8 hours, 1 week, or indefinitely.
- **Appearance:** High-quality Glassmorphism design system with support for dark/light themes.
- **Notification Toggles:** Global switch to enable or disable push/local alerts.

## 🚀 Performance & Stability
- **Rate Limiting:** Protects the server and client from message flooding (Client-side throttling).
- **Foreground Sync:** Automatically re-fetches latest messages and updates status when the app is resumed.
- **Scroll Memory:** Remembers your exact scroll position in every chat and resumes it when you return.
- **Smart Auto-Scroll:** Only snaps to the bottom for new messages if you are already near the end of the conversation.
- **Optimistic UI:** Local tracking of sending states for a faster perceived experience.
- **Failed Message Handling:** Visual indicators and retry logic for messages that fail to send due to network issues.

## 🎨 UI/UX Highlights
- **Glassmorphism:** Premium-feel UI with translucent cards and sleek borders.
- **Themed Components:** Consistent use of `ThemedText` and `GlassCard` for a unified aesthetic.
- **Safe Area Support:** Optimized layout for all modern mobile displays (notches, home bars).
- **Haptic Feedback:** Subtitle feedback for interactions (native feel).
- **Empty States:** Beautifully designed placeholders for empty chat lists or new conversations.

---
*Version 1.0.0 - WEBSKR*
