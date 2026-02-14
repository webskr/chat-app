/**
 * Parses a natural language time string into a Date object.
 * Supports:
 * - "5pm", "5:30pm", "17:00" (Today implied if future, else tomorrow? safely assume today)
 * - "tomorrow 9am"
 * - "today 8pm"
 * - "in 10 minutes", "in 1 hour"
 * 
 * Returns { date: Date, error: string | null }
 */
export const parseNaturalLanguageTime = (text: string): { date: Date | null, error: string | null, usedText?: string } => {
    const NOW = new Date();
    const cleanText = text.toLowerCase().trim();

    if (!cleanText) return { date: null, error: "Please enter a time." };

    try {
        let targetDate = new Date();
        let matchedString = '';

        // 1. "in X minutes/hours"
        const inMatch = cleanText.match(/^in\s+(\d+)\s*(m|min|minutes|mins|h|hr|hours|hrs)(?=\s|$)/);
        if (inMatch) {
            const amount = parseInt(inMatch[1]);
            const unit = inMatch[2];
            matchedString = inMatch[0];

            if (unit.startsWith('m')) {
                targetDate.setMinutes(NOW.getMinutes() + amount);
            } else if (unit.startsWith('h')) {
                targetDate.setHours(NOW.getHours() + amount);
            }
            return { ...validateDate(targetDate, NOW), usedText: matchedString };
        }

        // 2. "today/tomorrow" detection
        let searchDate = new Date(); // Start with today
        let timeString = cleanText;
        let dayOffset = 0;
        let dayPrefix = '';

        if (cleanText.startsWith('tomorrow')) {
            dayOffset = 1;
            dayPrefix = 'tomorrow';
            timeString = cleanText.replace('tomorrow', '').trim();
        } else if (cleanText.startsWith('today')) {
            dayPrefix = 'today';
            timeString = cleanText.replace('today', '').trim();
        }
        searchDate.setDate(NOW.getDate() + dayOffset);

        // 3. Time parsing (Simple formats: 5pm, 5:30pm, 17:00, 9am)
        // Regex Change: Changed `$` to `(?=\s|$)` to allow trailing text
        const timeMatch = timeString.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?=\s|$)/);

        if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const period = timeMatch[3];

            matchedString = timeMatch[0];
            // Reconstruct full used text including day prefix
            const fullUsedText = dayPrefix ? `${dayPrefix} ${matchedString}`.trim() : matchedString;

            if (hours > 24 || minutes > 59) return { date: null, error: "Invalid time format." };

            if (period) {
                if (period === 'pm' && hours < 12) hours += 12;
                if (period === 'am' && hours === 12) hours = 0;
            }

            searchDate.setHours(hours, minutes, 0, 0);

            // Special handling for "5pm" today if it's already 6pm -> assume tomorrow? 
            // Current validation logic rejects past times. 
            // If user explicitly said "today", we respect it and fail validation.
            // If user said NOTHING (just "5pm"), and it is past, we COULD assume tomorrow.
            // But let's stick to strictness + validation for now to avoid confusion.

            return { ...validateDate(searchDate, NOW), usedText: fullUsedText };
        }

        return { date: null, error: "Couldn't understand the time." };

    } catch (e) {
        return { date: null, error: "Invalid time format." };
    }
};

const validateDate = (date: Date, now: Date): { date: Date | null, error: string | null } => {
    if (date <= now) {
        return { date: null, error: "You can't schedule a message in the past." };
    }
    return { date, error: null };
};
