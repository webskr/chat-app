export const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export const extractFirstUrl = (text: string): string | null => {
    if (!text) return null;
    const match = text.match(URL_REGEX);
    return match ? match[0] : null;
};

export const hasUrl = (text: string): boolean => {
    if (!text) return false;
    // Reset regex index for test()
    const regex = new RegExp(URL_REGEX);
    return regex.test(text);
};
