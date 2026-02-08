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

    if (compareDate.getTime() === today.getTime()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    if (compareDate.getTime() === yesterday.getTime()) {
        return 'Yesterday';
    }

    return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};
