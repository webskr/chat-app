import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';

export default function AccountDeletionScreen() {
    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <ThemedText type="title" style={styles.headerTitle}>Account Deletion</ThemedText>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <ThemedText style={styles.intro}>
                    We respect your right to control your data. If you no longer wish to use Vegarm, you can permanently delete your account at any time.
                </ThemedText>

                <ThemedText style={styles.paragraph}>
                    This page explains how to delete your account, what happens after deletion, and what data is removed.
                </ThemedText>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>How to Delete Your Vegarm Account</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        You can delete your account in two simple ways:
                    </ThemedText>

                    <ThemedText style={styles.subTitle}>Option 1: Delete Account from the App (Recommended)</ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Open the Vegarm app." />
                        <BulletPoint text="Go to Settings." />
                        <BulletPoint text="Select Account." />
                        <BulletPoint text="Tap Delete Account." />
                        <BulletPoint text="Confirm your decision." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8 }]}>
                        Once confirmed, your account deletion request is processed.
                    </ThemedText>

                    <ThemedText style={styles.subTitle}>Option 2: Request Account Deletion by Email</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        If you cannot access the app, you can request deletion by email.
                    </ThemedText>
                    <View style={styles.emailBox}>
                        <ThemedText style={styles.paragraph}>📧 Send an email to:</ThemedText>
                        <TouchableOpacity onPress={() => Linking.openURL('mailto:draj88540@gmail.com')}>
                            <ThemedText style={styles.link}>draj88540@gmail.com</ThemedText>
                        </TouchableOpacity>
                        <ThemedText style={[styles.paragraph, { marginTop: 8 }]}>📌 Include the following details:</ThemedText>
                        <View style={styles.bulletList}>
                            <BulletPoint text="Registered email address." />
                            <BulletPoint text="Subject: Account Deletion Request – Vegarm" />
                        </View>
                        <ThemedText style={[styles.paragraph, { marginTop: 8 }]}>
                            We may ask for verification to ensure account security.
                        </ThemedText>
                    </View>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>What Happens When You Delete Your Account</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        When your Vegarm account is deleted:
                    </ThemedText>

                    <ThemedText style={styles.subTitle}>Data That Is Deleted</ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Your account profile (email, username, profile photo)." />
                        <BulletPoint text="All personal chats and self-chats." />
                        <BulletPoint text="Messages and media (images, videos, voice messages)." />
                        <BulletPoint text="One-time view and auto-delete message data." />
                        <BulletPoint text="Device-related identifiers linked to your account." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8, fontWeight: 'bold' }]}>
                        This data is permanently removed and cannot be recovered.
                    </ThemedText>

                    <ThemedText style={styles.subTitle}>Data Retention (Limited & Temporary)</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        In some cases, limited data may be retained for:
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Legal compliance." />
                        <BulletPoint text="Preventing abuse or fraud." />
                        <BulletPoint text="System integrity and security." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8 }]}>
                        Such data is stored securely, not used for marketing or tracking, and automatically removed after the required period.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Time Required for Deletion</ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Account deletion starts immediately after confirmation." />
                        <BulletPoint text="Complete removal may take up to a few days due to technical processing." />
                        <BulletPoint text="You will not be able to access your account during this time." />
                    </View>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Important Notes</ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Deleted accounts cannot be restored." />
                        <BulletPoint text="You will need to create a new account if you wish to use Vegarm again." />
                        <BulletPoint text="Deleting the app does not delete your account. You must follow the deletion process to remove your data." />
                    </View>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Children’s Data</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        Vegarm does not allow users under 13 years of age. If a child account is discovered, it will be removed immediately.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Need Help?</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        If you have any questions or issues related to account deletion, contact us:
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="📧 Support Email: draj88540@gmail.com" />
                        <BulletPoint text="📍 Country: India" />
                    </View>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Your Control, Your Choice</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        We believe users should always have full control over their data. Deleting your account means your personal data leaves our system permanently, subject only to minimal legal requirements.
                    </ThemedText>
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
    intro: {
        fontSize: 16,
        color: Colors.text,
        marginBottom: 16,
        lineHeight: 24,
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
    emailBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginTop: 8,
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
        backgroundColor: Colors.error || '#ef4444', // Red for delete context
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
