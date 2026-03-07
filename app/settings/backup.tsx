import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch } from 'react-native';
import { ChevronLeft, Cloud, HardDrive, RotateCcw, ShieldCheck, Trash2, Download } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { BackupService } from '../../utils/BackupService';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import * as DocumentPicker from 'expo-document-picker';

const LAST_BACKUP_KEY = 'last_backup_timestamp';

// Mocked for development - user should provide these in production
const GOOGLE_CONFIG = {
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // Replace with real one
    offlineAccess: true,
    scopes: ['https://www.googleapis.com/auth/drive.appdata'],
};

import { useUser } from '../../context/UserContext';

export default function BackupSettingsScreen() {
    const { user } = useUser();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [lastBackup, setLastBackup] = useState<string | null>(null);
    const [isCloudEnabled, setIsCloudEnabled] = useState(false);

    useEffect(() => {
        loadSettings();
        GoogleSignin.configure(GOOGLE_CONFIG);
    }, []);

    const loadSettings = async () => {
        const timestamp = await AsyncStorage.getItem(LAST_BACKUP_KEY);
        setLastBackup(timestamp);
    };

    const handleCreateBackup = async () => {
        if (!user?.id) {
            Alert.alert("Error", "User not found. Please log in again.");
            return;
        }

        Alert.prompt(
            "Backup Password",
            "Create a password to encrypt your backup. You will need this to restore.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Create",
                    onPress: async (password) => {
                        if (!password || password.length < 4) {
                            Alert.alert("Error", "Password too short.");
                            return;
                        }
                        try {
                            setLoading(true);
                            const path = await BackupService.createBackup(password, String(user.id));

                            const now = new Date().toLocaleString();
                            await AsyncStorage.setItem(LAST_BACKUP_KEY, now);
                            setLastBackup(now);

                            Alert.alert("Success", `Local backup created successfully.`);
                        } catch (err: any) {
                            Alert.alert("Error", err.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ],
            "secure-text"
        );
    };

    const handleRestoreBackup = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/zip',
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            const selectedFile = result.assets[0];

            Alert.prompt("Enter Password", "Enter your backup decryption password.", async (password) => {
                if (!password) return;
                try {
                    setLoading(true);
                    await BackupService.restoreBackup(selectedFile.uri, password);
                    Alert.alert("Success", "Restore complete. The app will now restart to apply changes.", [
                        { text: "OK", onPress: () => Updates.reloadAsync() }
                    ]);
                } catch (err: any) {
                    Alert.alert("Error", err.message);
                } finally {
                    setLoading(false);
                }
            }, "secure-text");
        } catch (err: any) {
            Alert.alert("Error", "Could not open file picker.");
        }
    };

    const handleDeleteBackups = () => {
        Alert.alert(
            "Delete All Backups",
            "Are you sure you want to delete all local backup files? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await BackupService.deleteBackups();
                        await AsyncStorage.removeItem(LAST_BACKUP_KEY);
                        setLastBackup(null);
                        Alert.alert("Deleted", "All local backups have been removed.");
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft color="#000" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Backup & Restore</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.statusCard}>
                    <ShieldCheck color="#22c55e" size={48} />
                    <Text style={styles.statusTitle}>Your chats are E2EE</Text>
                    <Text style={styles.statusSubtitle}>
                        Backups are encrypted using your password. Not even Vegarm can read them.
                    </Text>
                    {lastBackup && (
                        <Text style={styles.lastBackup}>Last backup: {lastBackup}</Text>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Local Backup</Text>
                    <TouchableOpacity
                        style={styles.actionItem}
                        onPress={handleCreateBackup}
                        disabled={loading}
                    >
                        <View style={[styles.iconBox, { backgroundColor: '#f0fdf4' }]}>
                            <HardDrive color="#22c55e" size={20} />
                        </View>
                        <View style={styles.actionText}>
                            <Text style={styles.actionTitle}>Create Local Backup</Text>
                            <Text style={styles.actionSubtitle}>Save an encrypted archive to your storage.</Text>
                        </View>
                        {loading && <ActivityIndicator size="small" color="#22c55e" />}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionItem}
                        onPress={handleRestoreBackup}
                        disabled={loading}
                    >
                        <View style={[styles.iconBox, { backgroundColor: '#fdf2f8' }]}>
                            <RotateCcw color="#db2777" size={20} />
                        </View>
                        <View style={styles.actionText}>
                            <Text style={styles.actionTitle}>Restore from Local</Text>
                            <Text style={styles.actionSubtitle}>Restore chats and media from a file.</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Cloud Backup</Text>
                    <View style={styles.actionItem}>
                        <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                            <Cloud color="#3b82f6" size={20} />
                        </View>
                        <View style={styles.actionText}>
                            <Text style={styles.actionTitle}>Google Drive Sync</Text>
                            <Text style={styles.actionSubtitle}>Keep your backups safe in the cloud.</Text>
                        </View>
                        <Switch
                            value={isCloudEnabled}
                            onValueChange={setIsCloudEnabled}
                        />
                    </View>

                    <TouchableOpacity style={styles.actionItem} disabled={!isCloudEnabled}>
                        <View style={[styles.iconBox, { backgroundColor: '#fefce8' }]}>
                            <Download color="#ca8a04" size={20} />
                        </View>
                        <View style={styles.actionText}>
                            <Text style={styles.actionTitle}>Download from Drive</Text>
                            <Text style={styles.actionSubtitle}>Restore latest backup from Google Drive.</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.actionItem, { marginTop: 20 }]} onPress={handleDeleteBackups}>
                    <View style={[styles.iconBox, { backgroundColor: '#fef2f2' }]}>
                        <Trash2 color="#ef4444" size={20} />
                    </View>
                    <View style={styles.actionText}>
                        <Text style={[styles.actionTitle, { color: '#ef4444' }]}>Delete All Backups</Text>
                        <Text style={styles.actionSubtitle}>Wipe all local backup files.</Text>
                    </View>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f1f1',
    },
    backButton: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    content: { flex: 1, padding: 20 },
    statusCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 32,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    statusTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
    statusSubtitle: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20
    },
    lastBackup: {
        marginTop: 16,
        fontSize: 12,
        fontWeight: '600',
        color: '#94a3b8',
        textTransform: 'uppercase'
    },
    section: { marginBottom: 32 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16
    },
    actionText: { flex: 1 },
    actionTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
    actionSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 }
});
