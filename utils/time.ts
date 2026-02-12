/**
 * Formats a date string into a user-friendly chat timestamp.
 * - Today: 10:42 AM
 * - Yesterday: Yesterday
 * - Older: 12 Jan 2026
 */
export const formatChatTime = (dateString: string | Date): string => {
    if (!dateString) return '';

    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const now = new Date();

    // Reset times to compare dates only
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // Manual Time Format (h:mm A)
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const timeStr = `${formattedHours}:${formattedMinutes} ${ampm}`;

    if (compareDate.getTime() === today.getTime()) {
        return timeStr;
    }

    if (compareDate.getTime() === yesterday.getTime()) {
        return `Yesterday, ${timeStr}`;
    }

    // Manual Date Format (d MMM yyyy, h:mm A)
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getDate();
    const month = MONTHS[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}, ${timeStr}`;
};
