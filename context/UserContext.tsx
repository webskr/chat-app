import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { registerForPushNotificationsAsync } from '../utils/notifications';
import { Config } from '../constants/Config';
import { LocalDatabaseService } from '../utils/LocalDatabaseService';
import { initMediaFolder } from '../utils/initMediaFolder';
import { SyncService } from '../utils/SyncService';
import { AppState } from 'react-native';
import { SecureStoreHelper } from '../utils/SecureStoreHelper';
import { ApiService } from '../utils/ApiService';
import { NetworkService } from '../utils/NetworkService';

interface User {
    id: string;
    username: string;
    display_name?: string;
    email: string;
    avatar_id: string;
    avatar_url?: string;
    bio?: string;
    username_last_updated?: string;
    global_auto_delete_minutes?: number;
    last_seen?: string;
    privacy_last_seen?: number;
    privacy_read_receipts?: number;
    privacy_profile_visibility?: 'public' | 'private';
    show_in_world?: number;
    neon_color?: string;
    border_color?: string;
    button_color?: string;
    auto_delete_otv?: number | boolean;
    scramble_name?: number | boolean;
    links?: string; // JSON string of { label: string, url: string }[]
    is_official?: number | boolean;
}

interface UserContextType {
    user: User | null;
    setUser: (user: User | null, tokens?: { access_token: string, refresh_token: string }) => Promise<void>;
    updateUserProfile: (data: Partial<User>) => Promise<void>;
    reloadUser: () => Promise<void>;
    isLoading: boolean;
    isDbReady: boolean;
    unreadCount: number;
    setUnreadCount: (count: number) => void;
    activeChatId: string | null;
    setActiveChatId: (id: string | null) => void;
    safeSync: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUserState] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDbReady, setIsDbReady] = useState(false);
    const isSyncingRef = React.useRef(false); // Guard against concurrent syncs
    const lastSyncTimeRef = React.useRef(0); // Throttle syncs (3000ms)
    const userRef = React.useRef<User | null>(null);
    const [activeChatId, setActiveChatIdState] = useState<string | null>(null);
    const activeChatIdRef = React.useRef<string | null>(null);
    const [appState, setAppState] = useState(AppState.currentState);

    // Keep userRef and activeChatIdRef in sync
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    useEffect(() => {
        activeChatIdRef.current = activeChatId;
        // Sync with LocalDatabaseService if possible
        try {
            (LocalDatabaseService as any).activeChatId = activeChatId;
        } catch (e) { }
    }, [activeChatId]);

    const setActiveChatId = (id: string | null) => {
        setActiveChatIdState(id);
    };

    const safeSync = async () => {
        // 0. DB Ready Guard (Silent)
        if (!isDbReady) return;

        // 0.1 Network Guard
        if (!NetworkService.getIsConnected()) {
            console.log("[UserContext] 📵 Skip Sync: Device is offline");
            return;
        }

        // 1. Sync Lock
        if (isSyncingRef.current) return;

        // 2. Throttle Guard (3s)
        const now = Date.now();
        if (now - lastSyncTimeRef.current < 3000) {
            return;
        }

        // 3. User Ready Guard
        if (!userRef.current?.id) return;

        // 4. Token Guard
        const accessToken = await SecureStoreHelper.getAccessToken();
        const refreshToken = await SecureStoreHelper.getRefreshToken();
        if (!accessToken || !refreshToken) {
            console.log("[UserContext] 🛑 No auth tokens, forcing logout");
            await setUser(null); // This clears AsyncStorage and SecureStore
            return;
        }

        console.log("[UserContext] 🚀 Smart Sync Triggered");
        isSyncingRef.current = true;

        try {
            await SyncService.syncEverything(Number(userRef.current.id));
            lastSyncTimeRef.current = Date.now();

            // After sync: check if ApiService cleared our tokens (refresh token was rejected by server)
            const postSyncAccessToken = await SecureStoreHelper.getAccessToken();
            const postSyncRefreshToken = await SecureStoreHelper.getRefreshToken();
            if (!postSyncAccessToken || !postSyncRefreshToken) {
                console.warn("[UserContext] 🛑 Tokens were cleared during sync (refresh token rejected). Forcing logout.");
                await setUser(null);
            }
        } catch (error) {
            console.error("[UserContext] safeSync error:", error);
        } finally {
            isSyncingRef.current = false;
        }
    };

    useEffect(() => {
        loadUser();
    }, []); // Only on mount

    useEffect(() => {
        if (appState === 'active' && isDbReady && user?.id) {
            console.log("[UserContext] 🛡️ Smart Sync Gate Opened");
            safeSync();
        }
    }, [appState, isDbReady, user?.id]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            setAppState(nextAppState);
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const loadUser = async () => {
        try {
            const userData = await AsyncStorage.getItem('user');
            console.log(`[UserContext] Loading user from storage... exists: ${!!userData}`);
            if (userData) {
                const parsedUser = JSON.parse(userData);
                console.log(`[UserContext] User ID extracted: ${parsedUser.id}`);

                // Check for tokens strictly
                const accessToken = await SecureStoreHelper.getAccessToken();
                const refreshToken = await SecureStoreHelper.getRefreshToken();
                console.log(`[UserContext] Access token exists: ${!!accessToken}`);
                console.log(`[UserContext] Refresh token exists: ${!!refreshToken}`);

                if (!accessToken || !refreshToken) {
                    console.log("[UserContext] 🛑 User session invalid (missing tokens), expunging user storage.");
                    // Completely clear user state manually instead of using setUser so we don't trigger recursive loads during mount
                    await AsyncStorage.removeItem('user');
                    await SecureStoreHelper.clearTokens();
                    setUserState(null);
                    return; // Stop loading DB and Context mapping immediately.
                }

                setUserState(parsedUser);
                // Initialize DB on reload
                console.log("[UserContext] Calling LocalDatabaseService.initDB...");
                await LocalDatabaseService.initDB(String(parsedUser.id));
                setIsDbReady(true);

                console.log("[UserContext] isDbReady set to true.");
                // 🗂️ Ensure Android/media/com.skr.vegarm folder exists
                initMediaFolder().catch(() => { });
            }
        } catch (error) {
            console.error('[UserContext] Error loading user:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const reloadUser = async () => {
        // First load from local storage to be quick
        await loadUser();

        // Then fetch fresh data if we have a user
        try {
            const currentUserStr = await AsyncStorage.getItem('user');
            if (currentUserStr) {
                const currentUser = JSON.parse(currentUserStr);
                const response = await ApiService.get(`${Config.API_URL}/users/get_user.php?user_id=${currentUser.id}`);
                if (response.ok) {
                    const freshUser = await response.json();
                    if (freshUser && freshUser.id) {
                        await setUser(freshUser);
                    }
                }
            }
        } catch (error) {
            console.error('Error reloading user from server:', error);
        }
    };

    const setUser = async (newUser: User | null, tokens?: { access_token: string, refresh_token: string }) => {
        try {
            if (newUser) {
                await AsyncStorage.setItem('user', JSON.stringify(newUser));

                if (tokens) {
                    await SecureStoreHelper.setAccessToken(tokens.access_token);
                    await SecureStoreHelper.setRefreshToken(tokens.refresh_token);
                }

                // Register Device Token
                // We do this in background to not block UI
                if (Platform.OS !== 'web') {
                    registerForPushNotificationsAsync().then(token => {
                        if (token) {
                            console.log('Updating device token:', token);
                            ApiService.post(`${Config.API_URL}/auth/update_token.php`, { user_id: newUser.id, token })
                                .catch(err => console.error("Token update failed", err));
                        }
                    }).catch(err => console.error("Token registration failed", err));
                }

            } else {
                await AsyncStorage.removeItem('user');
                await SecureStoreHelper.clearTokens();
                LocalDatabaseService.resetConnection();
            }
            setUserState(newUser);
            if (newUser) {
                await LocalDatabaseService.initDB(newUser.id.toString());
                setIsDbReady(true);
                // 🗂️ Ensure Android/media/com.skr.vegarm folder exists (first login)
                initMediaFolder().catch(() => { });
            } else {
                setIsDbReady(false);
            }
        } catch (error) {
            console.error('Error saving user to storage:', error);
        }
    };

    const updateUserProfile = async (data: Partial<User>) => {
        if (!user) return;
        const updatedUser = { ...user, ...data };
        await setUser(updatedUser);
    };

    const [unreadCount, setUnreadCount] = useState(0);

    return (
        <UserContext.Provider value={{
            user, setUser, updateUserProfile, reloadUser, isLoading, isDbReady,
            unreadCount, setUnreadCount, activeChatId, setActiveChatId, safeSync
        }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error("useUser must be used within UserProvider");
    }
    return context;
}
