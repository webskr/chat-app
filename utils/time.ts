/**
 * Formats a date string into a user-friendly chat timestamp in IST (India).
 * - Today: 10:42 AM
 * - Yesterday: Yesterday, 10:42 AM
 * - Older: 12 Jan 2026, 10:42 AM
 *
 * Server sends PHP/MySQL timestamps in UTC without a timezone indicator.
 * We append 'Z' so JS parses them correctly as UTC, then display in IST.
 */
export const formatChatTime = (dateString: string | Date): string => {
    if (!dateString) return '';

    const IST = 'Asia/Kolkata';

    let date: Date;
    if (typeof dateString === 'string') {
        let normalized = dateString.trim();
        // PHP MySQL format: '2024-01-10 14:30:00' — convert space to T
        if (normalized.includes(' ') && !normalized.includes('T')) {
            normalized = normalized.replace(' ', 'T');
        }
        // If no timezone indicator, server is sending UTC — append Z
        if (!normalized.endsWith('Z') && !/[+\-]\d{2}:\d{2}$/.test(normalized)) {
            normalized = normalized + 'Z';
        }
        date = new Date(normalized);
        if (isNaN(date.getTime())) {
            date = new Date(dateString);
        }
    } else {
        date = dateString;
    }

    if (isNaN(date.getTime())) return '';

    // Get IST "now" and IST equivalent of the message date
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: IST }));
    const dateIST = new Date(date.toLocaleString('en-US', { timeZone: IST }));

    const today = new Date(nowIST.getFullYear(), nowIST.getMonth(), nowIST.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const compareDate = new Date(dateIST.getFullYear(), dateIST.getMonth(), dateIST.getDate());

    // Format time in IST: h:mm AM/PM
    const timeStr = date
        .toLocaleTimeString('en-IN', {
            timeZone: IST,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        })
        .replace(/\u202f/g, ' ')   // replace narrow no-break space
        .toUpperCase();

    if (compareDate.getTime() === today.getTime()) {
        return timeStr;
    }

    if (compareDate.getTime() === yesterday.getTime()) {
        return `Yesterday, ${timeStr}`;
    }

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${dateIST.getDate()} ${MONTHS[dateIST.getMonth()]} ${dateIST.getFullYear()}, ${timeStr}`;
};
