import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';

export default function TermsAndConditionsScreen() {
    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <ThemedText type="title" style={styles.headerTitle}>Terms & Conditions</ThemedText>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <ThemedText style={styles.lastUpdated}>Effective Date: Feb 16, 2026</ThemedText>
                <ThemedText style={styles.lastUpdated}>Last Updated: Feb 16, 2026</ThemedText>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>Welcome to Vegarm.</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        These Terms & Conditions (“Terms”) explain the rules, responsibilities, and rights that apply when you use the Vegarm application.
                    </ThemedText>
                    <ThemedText style={styles.paragraph}>
                        By downloading, installing, creating an account, or using Vegarm, you agree to these Terms. If you do not agree, please do not use the app.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>1. About Vegarm</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        Vegarm is a human-to-human chatting application, including self-chat, that allows users to:
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Send messages." />
                        <BulletPoint text="Share media (images, videos, voice messages, GIFs)." />
                        <BulletPoint text="Communicate privately using secure technologies." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8 }]}>
                        Vegarm is provided to help users communicate safely and responsibly.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>2. Eligibility to Use Vegarm</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        To use Vegarm:
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="You must be 13 years of age or older." />
                        <BulletPoint text="You must be legally allowed to use digital services in your country." />
                        <BulletPoint text="You must provide accurate and truthful information during registration." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8, fontWeight: 'bold' }]}>
                        If you are under 13, you are not permitted to use Vegarm.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>3. Account Registration & Responsibility</ThemedText>

                    <ThemedText style={styles.subTitle}>3.1 Account Creation</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        To use Vegarm, you must create an account using a valid email address and a password.
                    </ThemedText>
                    <ThemedText style={styles.paragraph}>
                        You are responsible for keeping your login credentials secure and all activities that occur under your account.
                    </ThemedText>

                    <ThemedText style={styles.subTitle}>3.2 Account Security</ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Do not share your password with others." />
                        <BulletPoint text="Do not use someone else’s account." />
                        <BulletPoint text="If you believe your account is compromised, contact us immediately." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8 }]}>
                        Vegarm is not responsible for losses caused by unauthorized access due to user negligence.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>4. User Conduct (Very Important)</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        Vegarm is built for respectful and lawful communication.
                    </ThemedText>

                    <ThemedText style={styles.subTitle}>4.1 What You Agree NOT to Do</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        You agree that you will not:
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Use Vegarm for illegal activities." />
                        <BulletPoint text="Harass, threaten, abuse, or harm others." />
                        <BulletPoint text="Send hateful, violent, or discriminatory content." />
                        <BulletPoint text="Share sexually explicit content involving minors." />
                        <BulletPoint text="Spam, scam, or deceive other users." />
                        <BulletPoint text="Spread malware, viruses, or harmful code." />
                        <BulletPoint text="Impersonate another person or organization." />
                    </View>

                    <ThemedText style={styles.subTitle}>4.2 Content Responsibility</ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="You are fully responsible for the content you send or share." />
                        <BulletPoint text="Vegarm does not control or monitor private messages." />
                        <BulletPoint text="However, accounts involved in abuse or illegal activity may be restricted or terminated." />
                    </View>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>5. Messages, Media & Communication</ThemedText>

                    <ThemedText style={styles.subTitle}>5.1 Message Privacy</ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Messages are end-to-end encrypted." />
                        <BulletPoint text="Only communicating users can read messages." />
                        <BulletPoint text="Vegarm cannot read your private messages." />
                    </View>

                    <ThemedText style={styles.subTitle}>5.2 One-Time View & Auto-Delete</ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="One-time view messages can be opened only once." />
                        <BulletPoint text="Auto-delete messages are removed after the selected time." />
                        <BulletPoint text="Deleted messages cannot be recovered." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8 }]}>
                        Users understand and accept that deletion is permanent.
                    </ThemedText>

                    <ThemedText style={styles.subTitle}>5.3 Media Sharing</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        When sharing media, you confirm you have the right to share it and it does not violate laws or rights of others. Vegarm is not responsible for content shared by users.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>6. Permissions & Device Access</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        Vegarm may request permissions such as Camera, Microphone, Storage/Media access, and Notifications. These permissions are used only to provide app features. You may manage permissions in your device settings.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>7. Third-Party Services</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        Vegarm integrates third-party services to function properly, including push notification services and GIF services (e.g., GIPHY). Use of these services is subject to their respective terms and policies. Vegarm is not responsible for third-party service behavior.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>8. Intellectual Property</ThemedText>

                    <ThemedText style={styles.subTitle}>8.1 Vegarm Content</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        The app design, logo, interface, and branding belong to Vegarm. You may not copy, modify, or distribute them without permission.
                    </ThemedText>

                    <ThemedText style={styles.subTitle}>8.2 User Content</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        You retain ownership of the content you create. By sending content through Vegarm, you grant us limited rights only to deliver that content to intended recipients. We do not claim ownership of your messages or media.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>9. Account Suspension & Termination</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        Vegarm reserves the right to suspend or terminate accounts that violate these Terms, restrict access for abusive, illegal, or harmful behavior, and remove content if required by law. Termination may occur with or without prior notice, depending on severity.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>10. Account Deletion</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        You may delete your account at any time. When you delete your account:
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="Your profile data is removed." />
                        <BulletPoint text="Chats and messages are permanently deleted." />
                        <BulletPoint text="Deleted data cannot be restored." />
                    </View>
                    <ThemedText style={[styles.paragraph, { marginTop: 8 }]}>
                        Some limited data may be retained temporarily for legal or security reasons.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>11. Service Availability</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        Vegarm is provided “as is” and “as available.” We do not guarantee uninterrupted service, error-free operation, or message delivery at all times. We may update features, temporarily suspend service for maintenance, or modify or discontinue parts of the app.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>12. Limitation of Liability</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        To the maximum extent allowed by law, Vegarm is not responsible for user-generated content, nor liable for indirect or incidental damages. Use of the app is at your own risk.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>13. Changes to These Terms</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        We may update these Terms when features change, legal requirements change, or security improvements are made. Updated Terms will be posted within the app or website. Continued use means acceptance of the updated Terms.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>14. Governing Law</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        These Terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of Indian courts.
                    </ThemedText>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>15. Contact Information</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        If you have questions about these Terms, contact us:
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="📧 Email: draj88540@gmail.com" />
                        <BulletPoint text="📍 Country: India" />
                    </View>
                </View>

                <View style={styles.section}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>16. Acceptance of Terms</ThemedText>
                    <ThemedText style={styles.paragraph}>
                        By using Vegarm, you confirm that:
                    </ThemedText>
                    <View style={styles.bulletList}>
                        <BulletPoint text="You have read and understood these Terms." />
                        <BulletPoint text="You agree to follow them." />
                        <BulletPoint text="You accept responsibility for your use of the app." />
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
        backgroundColor: Colors.accent, // Using accent color for terms bullets
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
