import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const SecureStoreHelper = {
    async setAccessToken(token: string) {
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
    },

    async getAccessToken() {
        return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    },

    async setRefreshToken(token: string) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    },

    async getRefreshToken() {
        return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    },

    async clearTokens() {
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
};
