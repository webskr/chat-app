import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../../constants/Config';
import { useUser } from '../../context/UserContext';
import { E2EEService } from '../../utils/E2EEService';
import { LocalDatabaseService } from '../../utils/LocalDatabaseService';

import { ApiService } from '../../utils/ApiService';
import { initMediaFolder } from '../../utils/initMediaFolder';

import { auth } from '../../utils/firebase';
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import * as Linking from 'expo-linking';

export default function LoginScreen() {
    const { setUser } = useUser();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [lastError, setLastError] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [mailSentTo, setMailSentTo] = useState('');

    // Handle Deep Link Redirect
    React.useEffect(() => {
        const handleDeepLink = async (event: { url: string }) => {
            const { url } = event;
            if (isSignInWithEmailLink(auth, url)) {
                let emailToUse = email || (await AsyncStorage.getItem('emailForSignIn'));
                if (!emailToUse) {
                    // If email is missing (e.g. opened in different browser/device), ask user
                    Alert.prompt(
                        "Confirm Email",
                        "Please enter your email to complete sign-in",
                        async (enteredEmail) => {
                            if (enteredEmail) completeSignIn(url, enteredEmail);
                        }
                    );
                } else {
                    completeSignIn(url, emailToUse);
                }
            }
        };

        const subscription = Linking.addEventListener('url', handleDeepLink);
        
        // Initial check if app was opened with a link
        Linking.getInitialURL().then((url) => {
            if (url) handleDeepLink({ url });
        });

        return () => subscription.remove();
    }, [email]);

    const completeSignIn = async (url: string, emailToUse: string) => {
        setIsLoading(true);
        try {
            const result = await signInWithEmailLink(auth, emailToUse, url);
            const idToken = await result.user.getIdToken();
            await AsyncStorage.removeItem('emailForSignIn');
            
            // Send Firebase ID Token to our PHP backend
            await handleBackendLogin(idToken);
        } catch (error) {
            console.error("Sign-in error:", error);
            Alert.alert("Error", "Failed to complete sign-in. Link may be expired.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRequestOtp = async () => {
        if (!email) {
            Alert.alert('Error', 'Please enter your email');
            return;
        }

        setIsLoading(true);
        setLastError('');
        try {
            const actionCodeSettings = {
                url: Config.AUTH_REDIRECT_URL,
                handleCodeInApp: true,
                iOS: { bundleId: 'com.yourcompany.chatapp' },
                android: {
                    packageName: 'com.yourcompany.chatapp',
                    installApp: true,
                    minimumVersion: '12'
                },
            };

            await sendSignInLinkToEmail(auth, email, actionCodeSettings);
            await AsyncStorage.setItem('emailForSignIn', email);
            setMailSentTo(email);
            setIsSuccess(true);
            Alert.alert('Success', 'A magic login link has been sent to your email.');
        } catch (error: any) {
            console.error('Firebase Auth error:', error);
            setLastError(error.message || 'Failed to send magic link');
            Alert.alert('Error', error.message || 'Failed to send magic link');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackendLogin = async (idToken: string) => {
        try {
            console.log(`Verifying Firebase Token with backend: ${Config.API_URL}/auth/login.php`);
            const response = await ApiService.post(`${Config.API_URL}/auth/login.php`, { firebase_token: idToken }, { skipAuth: true });
            const data = await response.json();

            if (response.ok) {
                await setUser(data.user, {
                    access_token: data.access_token,
                    refresh_token: data.refresh_token
                });
                setIsSuccess(true);

                // --- E2EE KEY INITIALIZATION ---
                try {
                    const currentVersion = await E2EEService.getCurrentKeyVersion(data.user.id);
                    const existingKey = await E2EEService.loadPrivateKey(data.user.id, currentVersion);
                    if (!existingKey) {
                        const identityKeyPair = await E2EEService.generateKeyPair();
                        const signedPreKeyPair = await E2EEService.generateKeyPair();
                        const oneTimePreKeys = [];
                        for (let i = 0; i < 50; i++) {
                            const otk = await E2EEService.generateKeyPair();
                            oneTimePreKeys.push({ key_id: i, public_key: otk.publicKey, private_key: otk.privateKey });
                        }
                        await E2EEService.savePrivateKey(data.user.id, identityKeyPair.privateKey, 1);
                        await E2EEService.setCurrentKeyVersion(data.user.id, 1);
                        await fetch(`${Config.API_URL}/chat/upload_keys.php`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_id: data.user.id,
                                identity_key_public: identityKeyPair.publicKey,
                                signed_pre_key_public: signedPreKeyPair.publicKey,
                                signed_pre_key_signature: "mock_signature",
                                one_time_pre_keys: oneTimePreKeys.map(k => ({ key_id: k.key_id, public_key: k.public_key }))
                            })
                        });
                    }
                } catch (cryptoErr) { console.error("E2EE init failed:", cryptoErr); }

                try {
                    await LocalDatabaseService.initDB(data.user.id.toString());
                    initMediaFolder().catch(() => { });
                } catch (dbErr) { console.error("Local DB init failed:", dbErr); }

                setTimeout(() => { router.replace('/(tabs)'); }, 1500);
            } else {
                Alert.alert('Backend Match Failed', data.message || 'Verification failed');
            }
        } catch (error) {
            console.error('Backend sync error:', error);
            Alert.alert('Error', 'Verified with Firebase, but could not sync with Chat Backend.');
        }
    };



    return (
        <View style={[styles.container, { backgroundColor: Colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <LinearGradient
                        colors={[Colors.primary, 'transparent']}
                        style={styles.headerGradient}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                    >
                        <View style={styles.headerContent}>
                            <View style={styles.logoContainer}>
                                <Ionicons name="chatbubbles" size={60} color={Colors.white} />
                            </View>
                            <Text style={styles.title}>Welcome Back</Text>
                            <Text style={styles.subtitle}>Login with a Magic Link</Text>
                        </View>
                    </LinearGradient>

                    <BlurView intensity={20} tint="dark" style={styles.glassCard}>
                        <View style={styles.inputContainer}>
                            <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email"
                                placeholderTextColor={Colors.textSecondary}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                editable={!mailSentTo}
                            />
                        </View>

                        {/* Success Message Display */}
                        {isSuccess && mailSentTo ? (
                            <View style={styles.successContainer}>
                                <Ionicons name="mail-unread-outline" size={24} color="#10B981" />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.successText}>
                                        Check your email! A magic link has been sent to:
                                    </Text>
                                    <Text style={[styles.successText, { fontWeight: 'bold' }]}>{mailSentTo}</Text>
                                    <Text style={[styles.successText, { marginTop: 4, fontStyle: 'italic' }]}>
                                        Click the link in your email to login automatically.
                                    </Text>
                                </View>
                            </View>
                        ) : null}

                        {/* Error Message Display */}
                        {lastError ? (
                            <View style={styles.errorContainer}>
                                <Ionicons name="alert-circle" size={20} color="#EF4444" />
                                <Text style={styles.errorText}>{lastError}</Text>
                            </View>
                        ) : null}

                        {!mailSentTo && (
                            <TouchableOpacity
                                style={[styles.button, isLoading && styles.buttonDisabled]}
                                onPress={handleRequestOtp}
                                disabled={isLoading}
                            >
                                <View style={[styles.buttonGradient, { backgroundColor: Colors.primary }]}>
                                    <Text style={styles.buttonText}>
                                        {isLoading ? 'Sending Link...' : 'Get Login Link'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}


                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Don't have an account? </Text>
                            <Link href="/(auth)/signup" asChild>
                                <TouchableOpacity>
                                    <Text style={styles.linkText}>Sign Up</Text>
                                </TouchableOpacity>
                            </Link>
                        </View>
                    </BlurView>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    headerGradient: {
        width: '100%',
        paddingTop: 80,
        paddingBottom: 40,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginBottom: 30,
        overflow: 'hidden',
    },
    headerContent: {
        alignItems: 'center',
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.white,
        marginBottom: 10,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    glassCard: {
        padding: 30,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        overflow: 'hidden',
        marginHorizontal: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 15,
        marginBottom: 20,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: 50,
        color: Colors.text,
        fontSize: 16,
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 30,
    },
    forgotPasswordText: {
        color: Colors.secondary,
        fontSize: 14,
    },
    button: {
        height: 55,
        borderRadius: 15,
        overflow: 'hidden',
        marginBottom: 20,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 10,
    },
    footerText: {
        color: Colors.textSecondary,
        fontSize: 14,
    },
    linkText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: 'bold',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 10,
        borderRadius: 10,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    errorText: {
        color: '#EF4444',
        marginLeft: 10,
        fontSize: 14,
        flex: 1,
    },
    successContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        padding: 10,
        borderRadius: 10,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    successText: {
        color: '#10B981',
        marginLeft: 10,
        fontSize: 14,
        flex: 1,
    },
});
