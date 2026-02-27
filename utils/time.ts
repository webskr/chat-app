/**
 * Formats a date string into a user-friendly chat timestamp in IST (India).
 * - Today:     10:42 AM
 * - Yesterday: Yesterday, 10:42 AM
 * - Older:     12 Jan 2026, 10:42 AM
 *
 * ⚠️  Hermes-safe: does NOT use toLocaleString() or Intl.DateTimeFormat
 *     since Hermes cannot parse locale-formatted date strings.
 *     Instead we manually shift UTC → IST by adding 5h30m offset.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // 330 min in ms
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatChatTime = (dateString: string | Date): string => {
    if (!dateString) return '';

    // ── 1. Parse to UTC Date ────────────────────────────────────────────────
    let date: Date;
    if (typeof dateString === 'string') {
        let s = dateString.trim();
        // PHP/MySQL: '2024-01-10 14:30:00' → needs T separator
        if (s.includes(' ') && !s.includes('T')) {
            s = s.replace(' ', 'T');
        }
        // No timezone indicator → server is UTC, append Z
        if (!s.endsWith('Z') && !/[+\-]\d{2}:\d{2}$/.test(s)) {
            s += 'Z';
        }
        date = new Date(s);
        if (isNaN(date.getTime())) date = new Date(dateString);
    } else {
        date = dateString;
    }

    if (isNaN(date.getTime())) return '';

    // ── 2. Shift to IST (UTC+5:30) ─────────────────────────────────────────
    // Create a synthetic UTC Date whose getUTC* methods give the IST values.
    const istDate = new Date(date.getTime() + IST_OFFSET_MS);
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);

    // ── 3. Day comparison (date-only, in IST) ───────────────────────────────
    const toDay = (d: Date) =>
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

    const msgDay = toDay(istDate);
    const today = toDay(nowIST);
    const yesterday = today - 24 * 60 * 60 * 1000;

    // ── 4. Format time h:mm AM/PM ───────────────────────────────────────────
    let h = istDate.getUTCHours();
    const m = istDate.getUTCMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const timeStr = `${h}:${m < 10 ? '0' : ''}${m} ${ampm}`;

    // ── 5. Return appropriate format ────────────────────────────────────────
    if (msgDay === today) return timeStr;
    if (msgDay === yesterday) return `Yesterday, ${timeStr}`;

    return `${istDate.getUTCDate()} ${MONTHS[istDate.getUTCMonth()]} ${istDate.getUTCFullYear()}, ${timeStr}`;
};
