import { Config } from '../constants/Config';
import { SecureStoreHelper } from './SecureStoreHelper';

interface RequestOptions extends RequestInit {
    skipAuth?: boolean;
}

export class ApiService {
    private static isRefreshing = false;
    private static refreshSubscribers: ((token: string) => void)[] = [];

    private static onTokenRefreshed(token: string) {
        this.refreshSubscribers.forEach((callback) => callback(token));
        this.refreshSubscribers = [];
    }

    private static addRefreshSubscriber(callback: (token: string) => void) {
        this.refreshSubscribers.push(callback);
    }

    static async fetch(url: string, options: RequestOptions = {}): Promise<Response> {
        const { skipAuth, ...fetchOptions } = options;

        let headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(fetchOptions.headers as Record<string, string> || {}),
        };

        if (!skipAuth) {
            const token = await SecureStoreHelper.getAccessToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        try {
            const response = await fetch(url, { ...fetchOptions, headers });

            if (response.status === 401 && !skipAuth) {
                // Attempt to refresh token
                if (!this.isRefreshing) {
                    this.isRefreshing = true;
                    try {
                        const refreshToken = await SecureStoreHelper.getRefreshToken();
                        if (!refreshToken) throw new Error('No refresh token available');

                        const refreshResponse = await fetch(`${Config.API_URL}/auth/refresh.php`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ refresh_token: refreshToken }),
                        });

                        if (refreshResponse.ok) {
                            const data = await refreshResponse.json();
                            await SecureStoreHelper.setAccessToken(data.access_token);
                            await SecureStoreHelper.setRefreshToken(data.refresh_token);
                            this.isRefreshing = false;
                            this.onTokenRefreshed(data.access_token);
                        } else {
                            // Refresh failed, logout user
                            await SecureStoreHelper.clearTokens();
                            throw new Error('Refresh token invalid');
                        }
                    } catch (error) {
                        this.isRefreshing = false;
                        throw error;
                    }
                }

                // Return a promise that resolves when the token is refreshed
                return new Promise((resolve, reject) => {
                    this.addRefreshSubscriber(async (newToken) => {
                        try {
                            headers['Authorization'] = `Bearer ${newToken}`;
                            resolve(await fetch(url, { ...fetchOptions, headers }));
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
            }

            return response;
        } catch (error: any) {
            console.error(`[ApiService] Network error for ${url}:`, error.message);
            throw error;
        }
    }

    static async get(url: string, options: RequestOptions = {}) {
        return this.fetch(url, { ...options, method: 'GET' });
    }

    static async post(url: string, body: any, options: RequestOptions = {}) {
        return this.fetch(url, {
            ...options,
            method: 'POST',
            body: JSON.stringify(body),
        });
    }
}
