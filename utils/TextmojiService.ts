import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_TEXTMOJIS, Textmoji } from '../constants/TextmojiList';

const USAGE_COUNTS_KEY = 'textmoji_usage_counts';
const RECENTS_KEY = 'textmoji_recents';
const MAX_RECENTS = 20;

export const TextmojiService = {
    /**
     * Get all textmojis with updated usage counts from storage
     */
    async getTextmojis(): Promise<Textmoji[]> {
        try {
            const countsStr = await AsyncStorage.getItem(USAGE_COUNTS_KEY);
            const counts = countsStr ? JSON.parse(countsStr) : {};
            
            return ALL_TEXTMOJIS.map(tm => ({
                ...tm,
                usage_count: (tm.usage_count || 0) + (counts[tm.id] || 0)
            }));
        } catch (error) {
            console.error('[TextmojiService] Error getting textmojis:', error);
            return ALL_TEXTMOJIS;
        }
    },

    /**
     * Get the most recently used textmojis
     */
    async getRecents(): Promise<Textmoji[]> {
        try {
            const recentsStr = await AsyncStorage.getItem(RECENTS_KEY);
            const recentIds: string[] = recentsStr ? JSON.parse(recentsStr) : [];
            const all = await this.getTextmojis();
            
            // Map IDs back to objects, maintaining order
            return recentIds
                .map(id => all.find(tm => tm.id === id))
                .filter((tm): tm is Textmoji => !!tm);
        } catch (error) {
            console.error('[TextmojiService] Error getting recents:', error);
            return [];
        }
    },

    /**
     * Record a usage of a textmoji
     */
    async recordUsage(id: string) {
        try {
            // Update usage counts
            const countsStr = await AsyncStorage.getItem(USAGE_COUNTS_KEY);
            const counts = countsStr ? JSON.parse(countsStr) : {};
            counts[id] = (counts[id] || 0) + 1;
            await AsyncStorage.setItem(USAGE_COUNTS_KEY, JSON.stringify(counts));

            // Update recents
            const recentsStr = await AsyncStorage.getItem(RECENTS_KEY);
            let recentIds: string[] = recentsStr ? JSON.parse(recentsStr) : [];
            
            // Remove if exists and add to front
            recentIds = [id, ...recentIds.filter(rid => rid !== id)].slice(0, MAX_RECENTS);
            await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(recentIds));
        } catch (error) {
            console.error('[TextmojiService] Error recording usage:', error);
        }
    }
};
