import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';

export default function PrivacyPolicyScreen() {
    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <ThemedText type="title" style={styles.headerTitle}>Privacy Policy for Vegram</ThemedText>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <ThemedText style={styles.lastUpdated}>Effective Date: Feb 16, 2026</ThemedText>
                <ThemedText style={styles.lastUpdated}>Last Updated: Feb 16, 2026</ThemedText>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Welcome to Vegram.</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        Your privacy and trust matter to us. This Privacy Policy explains what data we collect, why we collect it, how we protect it, and what control you have over your information when using Vegram.
                    </ThemedText>
                    <ThemedText style={styles.paragraph}>
                        Vegram is a secure human-to-human chatting application, including personal self-chat, designed to give users private and safe communication.
                    </ThemedText>
                    <ThemedText style={styles.paragraph}>
                        By installing or using Vegram, you agree to this Privacy Policy.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>1. Information We Collect (Explained Clearly)</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        We only collect information that is necessary to run the app properly. We never collect unnecessary or hidden data.
                    </ThemedText>

                    <ThemedText style={styles.subTitle}>1.1 Account Information</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        When you create a Vegram account, we collect:
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Email address: Required to create your account, secure your login, and help recover your account if you forget your password." />
                        <BulletPoint text="Password: Your password is never stored in plain text. It is securely encrypted and protected." />
                        <BulletPoint text="Username: Used to identify you inside the app and visible to other users you interact with." />
                        <BulletPoint text="Profile Photo (Optional): Only collected if you choose to upload one. Used only for profile display." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8, fontWeight: 'bold' }]}>
                        👉 We do not collect phone contacts, call logs, or personal files without your action.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>2. Chat & Message Data (Very Important)</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        Vegram is built with privacy-first architecture.
                    </ThemedText>

                    <ThemedText style={styles.subTitle}>2.1 End-to-End Encrypted Messages</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        All messages are end-to-end encrypted. This means:
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Only you and the person you chat with can read messages." />
                        <BulletPoint text="Even Vegram cannot read your messages." />
                    </View>

                    <ThemedText style={styles.subTitle}>2.2 What We Do NOT Read</ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Message text." />
                        <BulletPoint text="Media content." />
                        <BulletPoint text="Voice messages." />
                        <BulletPoint text="Private chats." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8 }]}>
                        We never monitor or read personal conversations.
                    </ThemedText>

                    <ThemedText style={styles.subTitle}>2.3 Message Metadata (Minimal & Necessary)</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        To make messaging work, we may process limited technical information such as:
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Message sent time." />
                        <BulletPoint text="Delivery status (sent / delivered)." />
                        <BulletPoint text="Sender and receiver IDs." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8 }]}>
                        This data does not reveal message content and is used only to deliver messages correctly.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>3. Media, Voice & Files (Explained Simply)</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        Vegram allows users to send images, videos, voice messages, GIFs, and files (if supported).
                    </ThemedText>

                    <ThemedText style={styles.subTitle}>3.1 How Media Is Used</ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Media is processed only to send it to the selected receiver." />
                        <BulletPoint text="We do not use your media for advertising or analysis." />
                    </View>

                    <ThemedText style={styles.subTitle}>3.2 One-Time View (OTV) Messages</ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="One-time view media can be opened only once." />
                        <BulletPoint text="After being viewed, it is automatically deleted." />
                        <BulletPoint text="It cannot be saved or viewed again." />
                    </View>

                    <ThemedText style={styles.subTitle}>3.3 Auto-Delete Messages</ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Users can choose a time duration." />
                        <BulletPoint text="Messages are deleted automatically after that time." />
                        <BulletPoint text="Once deleted, messages cannot be recovered." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8 }]}>
                        Deleted content is removed from our servers after a short technical cleanup period.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>4. Device & Technical Information</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        To keep Vegram stable and secure, we may collect:
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Device type (Android model, etc.)." />
                        <BulletPoint text="Operating system version." />
                        <BulletPoint text="App version." />
                        <BulletPoint text="Language settings." />
                        <BulletPoint text="Crash reports (only if app crashes)." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8 }]}>
                        This data helps fix bugs, improves app performance, and does not identify you personally.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>5. App Permissions (Why We Ask Them)</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        Vegram requests permissions only when required.
                    </ThemedText>

                    <View style={styles.bulletList}>
                        <BulletPoint text="Camera: Used for taking photos or videos inside chat." />
                        <BulletPoint text="Microphone: Used for recording voice messages." />
                        <BulletPoint text="Storage / Media Access: Used for sending and receiving images, videos, and files." />
                        <BulletPoint text="Notifications: Used for showing message alerts and important account notifications." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8, fontWeight: 'bold' }]}>
                        👉 You can manage or revoke permissions anytime from your device settings.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>6. How We Use Your Information</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        We use collected information only to:
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Create and manage your account." />
                        <BulletPoint text="Deliver messages securely." />
                        <BulletPoint text="Enable media sharing." />
                        <BulletPoint text="Send push notifications." />
                        <BulletPoint text="Prevent spam and abuse." />
                        <BulletPoint text="Improve app performance and security." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8, fontWeight: 'bold' }]}>
                        🚫 We never sell or rent your personal data.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>7. Data Storage & Security</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        Your data is protected with strong security measures.
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Stored on secure servers." />
                        <BulletPoint text="Encrypted during transmission." />
                        <BulletPoint text="Protected against unauthorized access." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8 }]}>
                        While no system is 100% secure, we continuously improve our security practices.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>8. Third-Party Services</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        We use trusted services to support core features.
                    </ThemedText>

                    <ThemedText style={styles.subTitle}>8.1 Firebase</ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Used for push notifications and infrastructure support." />
                        <BulletPoint text="Firebase may collect limited technical data according to its own privacy policies." />
                    </View>

                    <ThemedText style={styles.subTitle}>8.2 GIPHY</ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Used for sending GIFs in chats." />
                        <BulletPoint text="When using GIFs, searches and selections may be processed by GIPHY." />
                        <BulletPoint text="GIPHY’s privacy policy applies to GIF usage." />
                    </View>

                    <ThemedText style={styles.subTitle}>8.3 Future Services</ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="In future, we may add analytics (to improve user experience)." />
                        <BulletPoint text="We may add advertising (if introduced, users will be informed)." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8 }]}>
                        Any changes will be updated in this policy.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>9. User Rights & Control</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        You are always in control of your data. You can:
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Edit your profile." />
                        <BulletPoint text="Delete messages." />
                        <BulletPoint text="Clear chat history." />
                        <BulletPoint text="Enable auto-delete." />
                        <BulletPoint text="Delete your account anytime." />
                    </View>

                    <ThemedText style={styles.subTitle}>Account Deletion</ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="When you delete your account, personal data is removed." />
                        <BulletPoint text="Chats and messages are permanently deleted." />
                        <BulletPoint text="Data cannot be restored." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8 }]}>
                        You may also request deletion by contacting support.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>10. Children’s Privacy</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        Vegram is intended for users 13 years and older.
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="We do not knowingly collect data from children under 13." />
                        <BulletPoint text="If such data is found, it will be deleted immediately." />
                    </View>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>11. Changes to This Policy</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        We may update this Privacy Policy when features change, laws require updates, or security improvements are made. Updated versions will be posted clearly.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>12. Contact Information</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        For questions or privacy concerns:
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="📧 Email: draj88540@gmail.com" />
                        <BulletPoint text="📍 Country: India" />
                    </View>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>13. Your Consent</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        By using Vegram:
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="You agree to this Privacy Policy." />
                        <BulletPoint text="You understand how your data is handled." />
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const BulletPoint = ({ text }: { text: string }) => (
    <View style={styles.bulletItem}>
        <View style={styles.bullet} />
        <ThemedText style={styles.bulletText}>{text}</ThemedText>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.glassBorder,
        backgroundColor: Colors.background,
    },
    backButton: {
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        padding: 20,
    },
    lastUpdated: {
        textAlign: 'center',
        color: Colors.textSecondary,
        marginBottom: 4,
        fontSize: 14,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
        color: Colors.text,
    },
    subTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
        marginTop: 12,
        marginBottom: 6,
    },
    paragraph: {
        fontSize: 15,
        lineHeight: 24,
        color: Colors.textSecondary,
        marginBottom: 8,
    },
    bulletList: {
        marginTop: 4,
        gap: 8,
    },
    bulletItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingLeft: 8,
    },
    bullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.primary,
        marginTop: 8,
        marginRight: 12,
    },
    bulletText: {
        flex: 1,
        fontSize: 15,
        lineHeight: 22,
        color: Colors.textSecondary,
    },
    link: {
        color: Colors.primary,
        fontSize: 16,
        fontWeight: '600',
        marginTop: 4,
    },
});
