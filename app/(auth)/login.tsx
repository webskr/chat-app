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

export default function LoginScreen() {
    const { setUser } = useUser();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [lastError, setLastError] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    const handleLogin = async () => {
        setLastError(''); // Clear previous errors
        if (!email || !password) {
            setLastError('Please fill in all fields');
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setIsLoading(true);
        try {
            console.log(`Attempting login to: ${Config.API_URL}/auth/login.php`);
            const response = await ApiService.post(`${Config.API_URL}/auth/login.php`, { email, password }, { skipAuth: true });

            const data = await response.json();

            if (response.ok) {
                await setUser(data.user, {
                    access_token: data.access_token,
                    refresh_token: data.refresh_token
                });
                setIsLoading(false);
                setIsSuccess(true);
                setLastError('');

                // --- E2EE KEY INITIALIZATION & ROTATION ---
                try {
                    // Check if device already has keys for this user
                    const currentVersion = await E2EEService.getCurrentKeyVersion(data.user.id);
                    const existingKey = await E2EEService.loadPrivateKey(data.user.id, currentVersion);

                    if (!existingKey) {
                        console.log("Generating new E2EE keys for device...");
                        const identityKeyPair = await E2EEService.generateKeyPair();
                        const signedPreKeyPair = await E2EEService.generateKeyPair();

                        // Generate a batch of One-Time Pre-Keys
                        const oneTimePreKeys = [];
                        for (let i = 0; i < 50; i++) {
                            const otk = await E2EEService.generateKeyPair();
                            oneTimePreKeys.push({
                                key_id: i,
                                public_key: otk.publicKey,
                                private_key: otk.privateKey
                            });
                        }

                        // Save locally v1
                        await E2EEService.savePrivateKey(data.user.id, identityKeyPair.privateKey, 1);
                        await E2EEService.setCurrentKeyVersion(data.user.id, 1);
                        await E2EEService.setLastRotationTime(data.user.id, Date.now());

                        // Upload public keys to server
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
                        console.log("E2EE Keys v1 initialized successfully.");
                    } else {
                        // Keys exist, check if rotation is needed
                        const needsRotation = await E2EEService.checkRotationNeeded(data.user.id);
                        if (needsRotation) {
                            await E2EEService.rotateKeys(data.user.id, Config);
                        }
                    }
                } catch (cryptoErr) {
                    console.error("Failed to initialize or rotate E2EE keys:", cryptoErr);
                }
                // --- END E2EE SETUP ---

                // --- LOCAL DB INIT ---
                try {
                    console.log("Initializing secure local database...");
                    await LocalDatabaseService.initDB(data.token || data.user.id.toString());
                } catch (dbErr) {
                    console.error("Failed to initialize local DB:", dbErr);
                }

                // Redirect after a short delay so they can see the success message
                setTimeout(() => {
                    router.replace('/(tabs)');
                }, 1500);
            } else {
                setIsLoading(false);
                const msg = data.message || 'Invalid credentials';
                setLastError(msg);
                Alert.alert('Login Failed', msg);
            }
        } catch (error) {
            setIsLoading(false);
            console.error('Login error:', error);
            const errorMsg = `Could not connect to server: ${error instanceof Error ? error.message : 'Unknown error'}`;
            setLastError(errorMsg);
            Alert.alert('Error', errorMsg);
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
                            <Text style={styles.subtitle}>Login to your account</Text>
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
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor={Colors.textSecondary}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <TouchableOpacity style={styles.forgotPassword}>
                            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                        </TouchableOpacity>

                        {/* Success Message Display */}
                        {isSuccess ? (
                            <View style={styles.successContainer}>
                                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                <Text style={styles.successText}>Logged in successfully! Redirecting...</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.button, isLoading && styles.buttonDisabled]}
                            onPress={handleLogin}
                            disabled={isLoading}
                        >
                            <View style={[styles.buttonGradient, { backgroundColor: Colors.primary }]}>
                                <Text style={styles.buttonText}>
                                    {isLoading ? 'Logging in...' : 'Login'}
                                </Text>
                            </View>

                        </TouchableOpacity>

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
