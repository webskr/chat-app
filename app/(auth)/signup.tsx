import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, ToastAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Config } from '../../constants/Config';
import { initMediaFolder } from '../../utils/initMediaFolder';

import { auth } from '../../utils/firebase';
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import * as Linking from 'expo-linking';

export default function SignupScreen() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [lastError, setLastError] = useState('');
    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [mailSentTo, setMailSentTo] = useState('');

    React.useEffect(() => {
        AsyncStorage.getItem('pending_invite_code').then(code => {
            if (code) {
                console.log('Found pending invite code during signup:', code);
                setInviteCode(code);
            }
        });
    }, []);

    // Handle Deep Link Redirect
    React.useEffect(() => {
        const handleDeepLink = async (event: { url: string }) => {
            const { url } = event;
            if (isSignInWithEmailLink(auth, url)) {
                let emailToUse = email || (await AsyncStorage.getItem('emailForSignIn'));
                let usernameToUse = username || (await AsyncStorage.getItem('usernameForSignIn'));
                
                if (!emailToUse) {
                    Alert.alert("Error", "Session expired. Please try signing up again.");
                    return;
                }
                
                completeSignup(url, emailToUse, usernameToUse || '');
            }
        };

        const subscription = Linking.addEventListener('url', handleDeepLink);
        Linking.getInitialURL().then((url) => { if (url) handleDeepLink({ url }); });
        return () => subscription.remove();
    }, [email, username]);

    const completeSignup = async (url: string, emailToUse: string, usernameToUse: string) => {
        setIsLoading(true);
        try {
            const result = await signInWithEmailLink(auth, emailToUse, url);
            const idToken = await result.user.getIdToken();
            
            // Cleanup temp storage
            await AsyncStorage.removeItem('emailForSignIn');
            await AsyncStorage.removeItem('usernameForSignIn');
            
            // Send to PHP Backend to finalize account
            await handleBackendSignup(idToken, usernameToUse);
        } catch (error) {
            console.error("Signup link error:", error);
            Alert.alert("Error", "Failed to verify link. It may be expired.");
        } finally {
            setIsLoading(false);
        }
    };

    const validateInputs = () => {
        if (!username || !email) return 'Please fill in all fields';
        const allowedDomains = ['gmail.com', 'outlook.com'];
        const domain = email.split('@')[1];
        if (!domain || !allowedDomains.includes(domain.toLowerCase())) {
            return 'Only @gmail.com and @outlook.com are allowed';
        }
        return null;
    };

    const handleSendOtp = async () => {
        const error = validateInputs();
        if (error) { Alert.alert('Error', error); return; }

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
            await AsyncStorage.setItem('usernameForSignIn', username);
            
            setMailSentTo(email);
            Alert.alert('Success', 'A verification link has been sent to your email.');
        } catch (error: any) {
            console.error('Firebase Signup error:', error);
            setLastError(error.message);
            Alert.alert('Error', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackendSignup = async (idToken: string, usernameToUse: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${Config.API_URL}/auth/signup.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    firebase_token: idToken,
                    username: usernameToUse,
                    invite_code: inviteCode 
                }),
            });

            const data = await response.json();

            if (response.ok) {
                if (Platform.OS === 'android') {
                    ToastAndroid.show('Account created successfully!', ToastAndroid.LONG);
                }
                if (inviteCode) await AsyncStorage.removeItem('pending_invite_code');
                initMediaFolder().catch(() => { });
                router.replace('/(auth)/login');
            } else {
                Alert.alert('Registration Failed', data.message || 'Could not finalize account');
            }
        } catch (error) {
            console.error('Signup sync error:', error);
            Alert.alert('Error', 'Verified with Firebase, but could not sync with Chat Backend.');
        } finally {
            setIsLoading(false);
        }
    };



    return (
        <View style={[styles.container, { backgroundColor: Colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={Colors.text} />
                    </TouchableOpacity>

                    <LinearGradient
                        colors={[Colors.primary, 'transparent']}
                        style={styles.headerGradient}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                    >
                        <View style={styles.headerContent}>
                            <View style={styles.logoContainer}>
                                <Ionicons name="person-add" size={50} color={Colors.white} />
                            </View>
                            <Text style={styles.title}>Create Account</Text>
                            <Text style={styles.subtitle}>Join with a Magic Link</Text>
                        </View>
                    </LinearGradient>

                    <BlurView intensity={20} tint="dark" style={styles.glassCard}>
                        <View style={styles.inputContainer}>
                            <Ionicons name="person-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Username"
                                placeholderTextColor={Colors.textSecondary}
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                                editable={!mailSentTo}
                            />
                        </View>

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
                        {mailSentTo ? (
                            <View style={styles.successContainer}>
                                <Ionicons name="mail-unread-outline" size={24} color="#10B981" />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.successText}>
                                        Check your email! A registration link has been sent to:
                                    </Text>
                                    <Text style={[styles.successText, { fontWeight: 'bold' }]}>{mailSentTo}</Text>
                                    <Text style={[styles.successText, { marginTop: 4, fontStyle: 'italic' }]}>
                                        Click the link in your email to complete registration.
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
                                onPress={handleSendOtp}
                                disabled={isLoading}
                            >
                                <View style={[styles.buttonGradient, { backgroundColor: Colors.primary }]}>
                                    <Text style={styles.buttonText}>
                                        {isLoading ? 'Sending Link...' : 'Register via Email Link'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}


                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Already have an account? </Text>
                            <Link href="/(auth)/login" asChild>
                                <TouchableOpacity>
                                    <Text style={styles.linkText}>Login</Text>
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
        paddingBottom: 40,
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
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
        width: 90,
        height: 90,
        borderRadius: 45,
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
        padding: 25,
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
        marginBottom: 15,
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
    button: {
        height: 55,
        borderRadius: 15,
        overflow: 'hidden',
        marginTop: 10,
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
        marginTop: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    errorText: {
        color: '#EF4444',
        marginLeft: 10,
        fontSize: 14,
        flex: 1,
    },
});
