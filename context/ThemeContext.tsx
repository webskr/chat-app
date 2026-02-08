import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';
import { useUser } from './UserContext';

interface ThemeContextType {
    neonColor: string;
    setNeonColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const DEFAULT_NEON_COLOR = '#036727'; // WhatsApp-like Green

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [neonColor, setNeonColorState] = useState<string>(DEFAULT_NEON_COLOR);

    const { user } = useUser();

    useEffect(() => {
        loadTheme();
    }, []);

    useEffect(() => {
        if (user?.neon_color) {
            setNeonColorState(user.neon_color);
        }
    }, [user?.neon_color]);

    const loadTheme = async () => {
        try {
            const storedColor = await AsyncStorage.getItem('neonColor');
            if (storedColor) {
                setNeonColorState(storedColor);
            }
        } catch (error) {
            console.error('Error loading theme:', error);
        }
    };

    const setNeonColor = async (color: string) => {
        try {
            await AsyncStorage.setItem('neonColor', color);
            setNeonColorState(color);
        } catch (error) {
            console.error('Error saving theme:', error);
        }
    };

    return (
        <ThemeContext.Provider value={{ neonColor, setNeonColor }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
