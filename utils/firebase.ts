import { initializeApp } from "firebase/app";
// @ts-ignore - This function is exported from the React Native entry point of firebase/auth
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Config } from "../constants/Config";

// Initialize Firebase
const app = initializeApp(Config.FIREBASE);

// Initialize Firebase Authentication with AsyncStorage persistence for React Native
export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
});

export default app;
