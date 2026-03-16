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

/**
 * Parses a date string into a Date object, handling server IST strings vs client UTC strings.
 * - Server: '2024-01-10 14:30:00' (Naive, always IST)
 * - Client: '2024-01-10T14:30:00.000Z' (ISO, always UTC)
 */
export const parseToDate = (dateString: string | Date | number): Date => {
    if (dateString instanceof Date) return dateString;
    if (typeof dateString === 'number') return new Date(dateString);
    if (!dateString) return new Date();

    let s = dateString.trim();

    // 1. Detect MySQL Naive format (Space instead of T, no TZ info)
    // We assume these are ALWAYS IST because the server is set to Kolkata.
    if (s.includes(' ') && !s.includes('T') && !s.endsWith('Z') && !/[+\-]\d{2}:\d{2}$/.test(s)) {
        s = s.replace(' ', 'T') + '+05:30';
    }

    const date = new Date(s);
    if (isNaN(date.getTime())) return new Date(dateString); // Fallback
    return date;
};

/**
 * Formats a date into a user-friendly chat timestamp in IST.
 */
export const formatChatTime = (dateInput: string | Date | number): string => {
    if (!dateInput) return '';

    // ── 1. Normalize to real Date object ───────────────────────────────────
    const date = parseToDate(dateInput);
    if (isNaN(date.getTime())) return '';

    // ── 2. Shift to IST Synthetic Date (for getUTC* methods) ───────────────
    // We want the getUTC* methods to return the IST values.
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

    const currentYear = new Date().getFullYear();
    const isThisYear = istDate.getUTCFullYear() === currentYear;

    if (isThisYear) {
        return `${istDate.getUTCDate()} ${MONTHS[istDate.getUTCMonth()]}, ${timeStr}`;
    }

    return `${istDate.getUTCDate()} ${MONTHS[istDate.getUTCMonth()]} ${istDate.getUTCFullYear()}, ${timeStr}`;
};
