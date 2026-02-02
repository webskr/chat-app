import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
    id: string;
    username: string;
    email: string;
    avatar_id: string;
}

interface UserContextType {
    user: User | null;
    setUser: (user: User | null) => void;
    updateUserProfile: (data: Partial<User>) => Promise<void>;
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
        <UserContext.Provider value={{ user, setUser, updateUserProfile, isLoading }}>
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
