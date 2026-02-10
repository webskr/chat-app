import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, ToastAndroid } from 'react-native';
import { Link, router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Config } from '../../constants/Config';

export default function SignupScreen() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [lastError, setLastError] = useState('');

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
                body: JSON.stringify({ username, email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                setIsLoading(false);
                console.info('Signup response OK, showing alert');
                if (Platform.OS === 'android') {
                    ToastAndroid.show('Account created successfully!', ToastAndroid.LONG);
                } else {
                    Alert.alert('Success', 'Account created successfully!');
                }
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

                    <View style={styles.header}>
                        <Text style={styles.title}>Create Account</Text>
                        <Text style={styles.subtitle}>Join our community today</Text>
                    </View>

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
        justifyContent: 'center',
        padding: 20,
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
        marginTop: 60,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
    },
    glassCard: {
        padding: 25,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        overflow: 'hidden',
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
