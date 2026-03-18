import { Config } from '../constants/Config';
import { SecureStoreHelper } from './SecureStoreHelper';

interface RequestOptions extends RequestInit {
    skipAuth?: boolean;
}

export class ApiService {
    private static onAuthFailure: (() => void) | null = null;
    private static isRefreshing = false;
    private static refreshSubscribers: { resolve: (token: string) => void; reject: (error: any) => void }[] = [];

    static setAuthFailureListener(listener: () => void) {
        this.onAuthFailure = listener;
    }

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
                console.warn(`[ApiService] 🛑 Request to ${url} refused: No refresh token (session expired)`);
                if (this.onAuthFailure) this.onAuthFailure();
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
                            this.onTokenRefreshed(data.access_token);

                            headers['Authorization'] = `Bearer ${data.access_token}`;
                            return fetch(url, { ...fetchOptions, headers });
                        } else {
                            // Refresh failed on server
                            let body = '';
                            try { body = await refreshResponse.text(); } catch (_) { }
                            const status = refreshResponse.status;
                            
                            console.warn(`[ApiService] ❌ Refresh failed (HTTP ${status}): ${body.substring(0, 100)}`);
                            
                            if (status === 401 || status === 403) {
                                // Explicitly invalid session/token
                                console.error('[ApiService] 🛑 Session invalid. Clearing tokens.');
                                await SecureStoreHelper.clearTokens();
                                const error = new Error('Refresh token invalid');
                                this.onTokenRefreshFailed(error);
                                this.isRefreshing = false;

                                if (this.onAuthFailure) {
                                    console.log('[ApiService] 📣 Triggering global auth failure (401/403)');
                                    this.onAuthFailure();
                                }
                                throw error;
                            } else {
                                // Server error (5xx) or other transient error
                                // Keep the current refresh token! Do not logout.
                                console.warn('[ApiService] ⚠️ Transient server error during refresh. Retaining tokens for retry.');
                                const error = new Error(`Server error ${status}`);
                                this.onTokenRefreshFailed(error);
                                this.isRefreshing = false;
                                throw error;
                            }
                        }
                    } catch (error) {
                        // Network error or unexpected exception
                        console.error('[ApiService] ⚠️ Network error during token refresh. Keeping session for retry.');
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
