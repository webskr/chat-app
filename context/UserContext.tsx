import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
    country?: string;
    state?: string;
    district?: string;
    global_auto_delete_minutes?: number;
    global_auto_delete_individual?: number;
    global_auto_delete_group?: number;

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
    scramble_value?: string;
    links?: string; // JSON string of { label: string, url: string }[]
    tags?: string; // JSON string of string[]
    is_official?: number | boolean;
    notifications_enabled?: number;
    hide_notification_message?: number;
    hide_notification_name?: number;
}

interface UserContextType {
    user: User | null;
    isProfileComplete: boolean;
    setUser: (user: User | null, tokens?: { access_token: string, refresh_token: string }) => Promise<void>;
    updateUserProfile: (data: Partial<User>) => Promise<void>;
    reloadUser: () => Promise<void>;
    isLoading: boolean;
    isDbReady: boolean;
    unreadCount: number;
    requestCount: number;
    setUnreadCount: (count: number) => void;
    activeChatId: string | null;
    setActiveChatId: (id: string | null) => void;
    safeSync: () => Promise<void>;
    fetchRequestCount: () => Promise<void>;
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
        if (!isDbReady) return;
        if (!NetworkService.getIsConnected()) return;
        if (isSyncingRef.current) return;

        const now = Date.now();
        if (now - lastSyncTimeRef.current < 3000) return;

        if (!userRef.current?.id) return;

        const accessToken = await SecureStoreHelper.getAccessToken();
        const refreshToken = await SecureStoreHelper.getRefreshToken();
        if (!accessToken || !refreshToken) return;

        console.log("[UserContext] 🚀 Smart Sync Triggered");
        isSyncingRef.current = true;
        lastSyncTimeRef.current = now; // Set immediately to block rapid fire

        try {
            await SyncService.syncEverything(Number(userRef.current.id));

            const postSyncAccessToken = await SecureStoreHelper.getAccessToken();
            const postSyncRefreshToken = await SecureStoreHelper.getRefreshToken();
            if (!postSyncAccessToken || !postSyncRefreshToken) {
                console.warn("[UserContext] 🛑 Tokens were cleared during sync. Forcing logout.");
                await setUser(null);
            }
        } catch (error) {
            console.error("[UserContext] safeSync error:", error);
        } finally {
            isSyncingRef.current = false;
        }
    };

    useEffect(() => {
        // Register global auth failure listener
        ApiService.setAuthFailureListener(async () => {
            console.warn("[UserContext] 🚨 Irrecoverable auth failure detected via ApiService. Forcing logout.");
            await setUser(null);
        });

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

                const accessToken = await SecureStoreHelper.getAccessToken();
                const refreshToken = await SecureStoreHelper.getRefreshToken();
                
                if (!accessToken || !refreshToken) {
                    console.warn("[UserContext] ⚠️ Some auth tokens missing during load.");
                }

                // Initialize DB BEFORE setting state to ensure isDbReady can be set together or soon after
                console.log("[UserContext] Calling LocalDatabaseService.initDB...");
                await LocalDatabaseService.initDB(String(parsedUser.id));
                await LocalDatabaseService.ensureSelfChat(String(parsedUser.id));
                
                // Batch these updates
                setUserState(parsedUser);
                setIsDbReady(true);

                console.log("[UserContext] isDbReady set to true.");
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

                if (Platform.OS !== 'web') {
                    registerForPushNotificationsAsync().then(token => {
                        if (token) {
                            ApiService.post(`${Config.API_URL}/auth/update_token.php`, { user_id: newUser.id, token })
                                .catch(() => {});
                        }
                    }).catch(() => {});
                }

                await LocalDatabaseService.initDB(newUser.id.toString());
                await LocalDatabaseService.ensureSelfChat(newUser.id.toString());
                
                setUserState(newUser);
                setIsDbReady(true);
                initMediaFolder().catch(() => { });
            } else {
                await AsyncStorage.removeItem('user');
                await SecureStoreHelper.clearTokens();
                LocalDatabaseService.resetConnection();
                setUserState(null);
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

    const isProfileComplete = useMemo(() => {
        if (!user) return true;
        return !!(
            user.username && 
            user.display_name?.trim() && 
            user.country?.trim() && 
            user.state?.trim() && 
            user.district?.trim()
        );
    }, [user]);

    const [unreadCount, setUnreadCount] = useState(0);
    const [requestCount, setRequestCount] = useState(0);

    const fetchRequestCount = useCallback(async () => {
        if (!user?.id) return;
        try {
            const response = await fetch(`${Config.API_URL}/users/get_requests.php?user_id=${user.id}`);
            if (response.ok) {
                const data = await response.json();
                setRequestCount(data.received?.length || 0);
            }
        } catch (error) {
            console.error('[UserContext] Error fetching request count:', error);
        }
    }, [user?.id]);

    useEffect(() => {
        if (user?.id) {
            fetchRequestCount();
            const interval = setInterval(fetchRequestCount, 15000); // Poll every 15s
            return () => clearInterval(interval);
        } else {
            setRequestCount(0);
        }
    }, [user?.id, fetchRequestCount]);

    const contextValue = useMemo(() => ({
        user,
        isProfileComplete,
        setUser,
        updateUserProfile,
        reloadUser,
        isLoading,
        isDbReady,
        unreadCount,
        setUnreadCount,
        requestCount,
        fetchRequestCount,
        activeChatId,
        setActiveChatId,
        safeSync
    }), [
        user, isProfileComplete, isLoading, isDbReady, 
        unreadCount, requestCount, activeChatId, 
        fetchRequestCount, setUser, updateUserProfile, reloadUser, setActiveChatId, safeSync
    ]);

    return (
        <UserContext.Provider value={contextValue}>
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
