import { Config } from '../constants/Config';
import { SecureStoreHelper } from './SecureStoreHelper';

interface RequestOptions extends RequestInit {
    skipAuth?: boolean;
}

export class ApiService {
    private static isRefreshing = false;
    private static refreshSubscribers: { resolve: (token: string) => void; reject: (error: any) => void }[] = [];

    private static onTokenRefreshed(token: string) {
        this.refreshSubscribers.forEach((subscriber) => subscriber.resolve(token));
        this.refreshSubscribers = [];
    }

    private static onTokenRefreshFailed(error: any) {
        this.refreshSubscribers.forEach((subscriber) => subscriber.reject(error));
        this.refreshSubscribers = [];
    }

    private static addRefreshSubscriber(resolve: (token: string) => void, reject: (error: any) => void) {
        this.refreshSubscribers.push({ resolve, reject });
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

            const refreshToken = await SecureStoreHelper.getRefreshToken();
            if (!refreshToken) {
                console.log(`[ApiService] 🛑 Blocked request to ${url} due to missing refresh token`);
                throw new Error("User not authenticated");
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
                        if (!refreshToken) {
                            const error = new Error('No refresh token available');
                            this.onTokenRefreshFailed(error);
                            this.isRefreshing = false;
                            throw error;
                        }

                        const refreshResponse = await fetch(`${Config.API_URL}/auth/refresh.php`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ refresh_token: refreshToken }),
                        });

                        if (refreshResponse.ok) {
                            const data = await refreshResponse.json();
                            await SecureStoreHelper.setAccessToken(data.access_token);
                            await SecureStoreHelper.setRefreshToken(data.refresh_token);
                            console.log('[ApiService] ✅ Token refreshed successfully');
                            this.isRefreshing = false;
                            // Notify any queued callers (isRefreshing=true while we were refreshing)
                            this.onTokenRefreshed(data.access_token);

                            // ✅ KEY FIX: First caller retries directly.
                            // onTokenRefreshed() already fired + cleared the subscriber list,
                            // so we CANNOT use the subscriber pattern here — we'd add a subscriber
                            // after the list is cleared and it would never be called.
                            headers['Authorization'] = `Bearer ${data.access_token}`;
                            return fetch(url, { ...fetchOptions, headers });
                        } else {
                            // Refresh failed — token invalid or expired on server
                            let body = '';
                            try { body = await refreshResponse.text(); } catch (_) { }
                            console.warn(`[ApiService] ❌ Refresh token rejected by server (HTTP ${refreshResponse.status}): ${body.substring(0, 200)}`);
                            await SecureStoreHelper.clearTokens();
                            const error = new Error('Refresh token invalid');
                            this.onTokenRefreshFailed(error);
                            this.isRefreshing = false;
                            throw error;
                        }
                    } catch (error) {
                        this.onTokenRefreshFailed(error);
                        this.isRefreshing = false;
                        throw error;
                    }
                }

                // Another call is already refreshing — queue and wait
                return new Promise((resolve, reject) => {
                    this.addRefreshSubscriber(
                        async (newToken) => {
                            try {
                                headers['Authorization'] = `Bearer ${newToken}`;
                                resolve(await fetch(url, { ...fetchOptions, headers }));
                            } catch (e) {
                                reject(e);
                            }
                        },
                        (error) => {
                            reject(error);
                        }
                    );
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
