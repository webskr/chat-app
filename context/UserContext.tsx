import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    website?: string;
    website_label?: string;
}

interface UserContextType {
    user: User | null;
    setUser: (user: User | null) => void;
    updateUserProfile: (data: Partial<User>) => Promise<void>;
    reloadUser: () => Promise<void>;
    isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUserState] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        try {
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
                setUserState(JSON.parse(userData));
            }
        } catch (error) {
            console.error('Error loading user from storage:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const reloadUser = async () => {
        await loadUser();
    };

    const setUser = async (newUser: User | null) => {
        try {
            if (newUser) {
                await AsyncStorage.setItem('user', JSON.stringify(newUser));
            } else {
                await AsyncStorage.removeItem('user');
            }
            setUserState(newUser);
        } catch (error) {
            console.error('Error saving user to storage:', error);
        }
    };

    const updateUserProfile = async (data: Partial<User>) => {
        if (!user) return;
        const updatedUser = { ...user, ...data };
        await setUser(updatedUser);
    };

    return (
        <UserContext.Provider value={{ user, setUser, updateUserProfile, reloadUser, isLoading }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
