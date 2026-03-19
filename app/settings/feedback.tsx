import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '../../context/UserContext';
import { Config } from '../../constants/Config';

export default function FeedbackScreen() {
    const { user } = useUser();
    const [name, setName] = useState(user?.display_name || user?.username || '');
    const [email, setEmail] = useState(user?.email || '');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        if (!name || !email || !message) {
            Alert.alert('Missing Fields', 'Please fill in all fields.');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${Config.API_URL}/feedback/send_feedback.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    email,
                    message,
                    user_id: user?.id
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                Alert.alert('Success', 'Thank you for your feedback! We will get back to you soon.', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            } else {
                Alert.alert('Error', data.message || 'Failed to send feedback. Please try again.');
            }
        } catch (error) {
            console.error('Feedback error:', error);
            Alert.alert('Error', 'Could not connect to server. Please check your internet connection.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: Colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Feedback & Support</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <LinearGradient
                        colors={[Colors.primary, 'transparent']}
                        style={styles.heroGradient}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                    >
                        <Ionicons name="chatbox-ellipses" size={60} color={Colors.white} />
                        <Text style={styles.heroTitle}>We'd Love to Hear From You</Text>
                        <Text style={styles.heroSubtitle}>Share your thoughts, report bugs, or just say hello!</Text>
                    </LinearGradient>

                    <BlurView intensity={20} tint="dark" style={styles.formCard}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Name</Text>
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="Your Name"
                                placeholderTextColor={Colors.textSecondary}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                value={email}
                                onChangeText={setEmail}
                                placeholder="your@email.com"
                                placeholderTextColor={Colors.textSecondary}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Message</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={message}
                                onChangeText={setMessage}
                                placeholder="Type your message here..."
                                placeholderTextColor={Colors.textSecondary}
                                multiline
                                textAlignVertical="top"
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={handleSubmit}
                            disabled={isLoading}
                        >
                            <LinearGradient
                                colors={[Colors.primary, '#047857']}
                                style={styles.gradientButton}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Text style={styles.submitText}>Send Feedback</Text>
                                        <Ionicons name="send" size={18} color="white" style={{ marginLeft: 8 }} />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </BlurView>

                    <View style={styles.contactInfo}>
                        <Text style={styles.contactText}>Or email us directly at</Text>
                        <Text style={styles.emailText}>support@vegram.app</Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: Colors.background,
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    heroGradient: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginBottom: 20,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.white,
        marginTop: 15,
        textAlign: 'center',
    },
    heroSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 5,
        textAlign: 'center',
    },
    formCard: {
        marginHorizontal: 20,
        padding: 20,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        backgroundColor: 'rgba(30, 30, 30, 0.6)',
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        color: Colors.textSecondary,
        marginBottom: 8,
        fontSize: 14,
        fontWeight: '600',
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 15,
        color: Colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    textArea: {
        height: 120,
    },
    submitButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 10,
        elevation: 5,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    gradientButton: {
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    contactInfo: {
        alignItems: 'center',
        marginTop: 30,
    },
    contactText: {
        color: Colors.textSecondary,
        fontSize: 14,
    },
    emailText: {
        color: Colors.primary,
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 5,
    },
});
