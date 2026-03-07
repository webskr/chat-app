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

export default function SignupScreen() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [lastError, setLastError] = useState('');
    const [inviteCode, setInviteCode] = useState<string | null>(null);

    React.useEffect(() => {
        AsyncStorage.getItem('pending_invite_code').then(code => {
            if (code) {
                console.log('Found pending invite code during signup:', code);
                setInviteCode(code);
            }
        });
    }, []);

    const handleSignup = async () => {
        setLastError('');
        if (!username || !email || !password || !confirmPassword) {
            const msg = 'Please fill in all fields';
            setLastError(msg);
            Alert.alert('Error', msg);
            return;
        }

        if (password !== confirmPassword) {
            const msg = 'Passwords do not match';
            setLastError(msg);
            Alert.alert('Error', msg);
            return;
        }

        setIsLoading(true);
        try {
            console.log(`Attempting signup to: ${Config.API_URL}/auth/signup.php`);
            const response = await fetch(`${Config.API_URL}/auth/signup.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, invite_code: inviteCode }),
            });

            let data;
            try {
                const text = await response.text();
                data = JSON.parse(text);
            } catch (parseError) {
                console.error("Non-JSON response received:", parseError);
                throw new Error("Server returned an invalid response. Please check your network connection or Config IP.");
            }

            if (response.ok) {
                setIsLoading(false);
                console.info('Signup response OK, showing alert');
                if (Platform.OS === 'android') {
                    ToastAndroid.show('Account created successfully!', ToastAndroid.LONG);
                } else {
                    Alert.alert('Success', 'Account created successfully!');
                }

                // Clear invite code after success
                if (inviteCode) {
                    await AsyncStorage.removeItem('pending_invite_code');
                }

                // 🗂️ Trigger upfront permissions (to avoid prompts later)
                initMediaFolder().catch(() => { });

                router.replace('/(auth)/login');
            } else {
                setIsLoading(false);
                const msg = data.message || 'Could not create account';
                setLastError(msg);
                Alert.alert('Registration Failed', msg);
            }
        } catch (error) {
            setIsLoading(false);
            console.error('Signup error:', error);
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
                            <Text style={styles.subtitle}>Join our community today</Text>
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

                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Confirm Password"
                                placeholderTextColor={Colors.textSecondary}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                            />
                        </View>

                        {/* Error Message Display */}
                        {lastError ? (
                            <View style={styles.errorContainer}>
                                <Ionicons name="alert-circle" size={20} color="#EF4444" />
                                <Text style={styles.errorText}>{lastError}</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.button, isLoading && styles.buttonDisabled]}
                            onPress={handleSignup}
                            disabled={isLoading}
                        >
                            <View style={[styles.buttonGradient, { backgroundColor: Colors.primary }]}>
                                <Text style={styles.buttonText}>
                                    {isLoading ? 'Creating Account...' : 'Sign Up'}
                                </Text>
                            </View>

                        </TouchableOpacity>

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
