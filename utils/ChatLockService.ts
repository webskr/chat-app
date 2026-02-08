import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCK_KEY_PREFIX = 'chat_lock_';
const PIN_KEY_PREFIX = 'chat_pin_';

export const ChatLockService = {
    // Hash the PIN for secure storage
    async hashPin(pin: string): Promise<string> {
        return await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            pin
        );
    },

    // Check if a specific chat is locked
    async isChatLocked(chatId: string): Promise<boolean> {
        try {
            if (Platform.OS === 'web') {
                const locked = await AsyncStorage.getItem(`${LOCK_KEY_PREFIX}${chatId}`);
                return locked === 'true';
            }
            const locked = await SecureStore.getItemAsync(`${LOCK_KEY_PREFIX}${chatId}`);
            return locked === 'true';
        } catch (error) {
            console.error('Error checking lock status:', error);
            return false;
        }
    },

    // Lock a chat with a PIN
    async lockChat(chatId: string, pin: string): Promise<void> {
        try {
            const hashedPin = await this.hashPin(pin);
            if (Platform.OS === 'web') {
                await AsyncStorage.setItem(`${LOCK_KEY_PREFIX}${chatId}`, 'true');
                await AsyncStorage.setItem(`${PIN_KEY_PREFIX}${chatId}`, hashedPin);
            } else {
                await SecureStore.setItemAsync(`${LOCK_KEY_PREFIX}${chatId}`, 'true');
                await SecureStore.setItemAsync(`${PIN_KEY_PREFIX}${chatId}`, hashedPin);
            }
        } catch (error) {
            console.error('Error locking chat:', error);
        }
    },

    // Unlock a chat (verify PIN)
    // Returns true if PIN is correct, false otherwise
    async verifyPin(chatId: string, pin: string): Promise<boolean> {
        try {
            let storedHash: string | null = null;

            if (Platform.OS === 'web') {
                storedHash = await AsyncStorage.getItem(`${PIN_KEY_PREFIX}${chatId}`);
            } else {
                storedHash = await SecureStore.getItemAsync(`${PIN_KEY_PREFIX}${chatId}`);
            }

            if (!storedHash) return false;

            const inputHash = await this.hashPin(pin);
            return inputHash === storedHash;
        } catch (error) {
            console.error('Error verifying PIN:', error);
            return false;
        }
    },

    // Remove lock from a chat
    async unlockChat(chatId: string): Promise<void> {
        try {
            if (Platform.OS === 'web') {
                await AsyncStorage.removeItem(`${LOCK_KEY_PREFIX}${chatId}`);
                await AsyncStorage.removeItem(`${PIN_KEY_PREFIX}${chatId}`);
            } else {
                await SecureStore.deleteItemAsync(`${LOCK_KEY_PREFIX}${chatId}`);
                await SecureStore.deleteItemAsync(`${PIN_KEY_PREFIX}${chatId}`);
            }
        } catch (error) {
            console.error('Error unlocking chat:', error);
        }
    }
};
