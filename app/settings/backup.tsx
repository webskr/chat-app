import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch, Modal, TextInput } from 'react-native';
import { ChevronLeft, Cloud, HardDrive, RotateCcw, ShieldCheck, Trash2, Download } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { BackupService } from '../../utils/BackupService';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import * as DocumentPicker from 'expo-document-picker';
import { LocalDatabaseService } from '../../utils/LocalDatabaseService';
import { GoogleDriveService } from '../../utils/GoogleDriveService';
const LAST_BACKUP_KEY = 'last_backup_timestamp';

// Mocked for development - user should provide these in production
const GOOGLE_CONFIG = {
    webClientId: '617829207220-lm7j89apn1ojd6kr0vv1ouogcj74ija4.apps.googleusercontent.com',
    offlineAccess: true,
    scopes: ['https://www.googleapis.com/auth/drive.appdata'],
};

import { useUser } from '../../context/UserContext';

export default function BackupSettingsScreen() {
    const { user } = useUser();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [lastBackup, setLastBackup] = useState<string | null>(null);
    const [passwordModalVisible, setPasswordModalVisible] = useState(false);
    const [backupPassword, setBackupPassword] = useState("");
    const [modalAction, setModalAction] = useState<"create" | "restore" | "create_drive" | "restore_drive" | null>(null);
    const [pendingRestoreFile, setPendingRestoreFile] = useState<any>(null);

    // Drive State
    const [driveBackups, setDriveBackups] = useState<any[]>([]);
    const [drivePickerVisible, setDrivePickerVisible] = useState(false);
    const [selectedDriveBackup, setSelectedDriveBackup] = useState<any>(null);

    useEffect(() => {
        loadSettings();
        GoogleSignin.configure(GOOGLE_CONFIG);
    }, []);

    const loadSettings = async () => {
        const timestamp = await AsyncStorage.getItem(LAST_BACKUP_KEY);
        setLastBackup(timestamp);
    };

    const handleCreateBackup = () => {
        if (!user?.id) {
            Alert.alert("Error", "User not found. Please log in again.");
            return;
        }
        setModalAction("create");
        setBackupPassword("");
        setPasswordModalVisible(true);
    };

    const submitCreateBackup = async (password: string) => {
        if (!password || password.length < 4) {
            Alert.alert("Error", "Password too short.");
            return;
        }
        try {
            setLoading(true);
            setPasswordModalVisible(false);
            const path = await BackupService.createBackup(password, String(user!.id));

            // CRITICAL: BackupService closes the DB. We MUST re-init it with the same id
            // (which acts as the encryption token in this app) so the app remains functional.
            if (user?.id) {
                await LocalDatabaseService.initDB(String(user.id));
            }

            const now = new Date().toLocaleString();
            await AsyncStorage.setItem(LAST_BACKUP_KEY, now);
            setLastBackup(now);

            Alert.alert("Success", `Local backup created successfully.`);
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRestoreBackup = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/zip',
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            setPendingRestoreFile(result.assets[0]);
            setModalAction("restore");
            setBackupPassword("");
            setPasswordModalVisible(true);
        } catch (err: any) {
            Alert.alert("Error", "Could not open file picker.");
        }
    };

    const submitRestoreBackup = async (password: string) => {
        if (!password) return;
        if (!pendingRestoreFile) return;

        try {
            setLoading(true);
            setPasswordModalVisible(false);
            await BackupService.restoreBackup(pendingRestoreFile.uri, password);
            Alert.alert("Success", "Restore complete. The app will now restart to apply changes.", [
                { text: "OK", onPress: () => Updates.reloadAsync() }
            ]);
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
            const userInfo = await GoogleSignin.signIn();
            return userInfo;
        } catch (error: any) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                console.log('User cancelled the login flow');
            } else if (error.code === statusCodes.IN_PROGRESS) {
                console.log('Sign in is in progress already');
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                Alert.alert('Error', 'Play services not available or outdated');
            } else {
                Alert.alert('Error signing in', error.message);
            }
            return null;
        }
    };

    const handleBackupToDrive = async () => {
        if (!user?.id) {
            Alert.alert("Error", "User not found. Please log in again.");
            return;
        }

        try {
            setLoading(true);
            const userInfo = await handleGoogleSignIn();
            if (!userInfo) return; // User cancelled or failed

            setModalAction("create_drive");
            setBackupPassword("");
            setPasswordModalVisible(true);
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setLoading(false);
        }
    };

    const submitBackupToDrive = async (password: string) => {
        if (!password || password.length < 4) {
            Alert.alert("Error", "Password too short.");
            return;
        }
        try {
            setLoading(true);
            setPasswordModalVisible(false);

            // 1. Create local backup
            const path = await BackupService.createBackup(password, String(user!.id));

            // Re-init DB
            if (user?.id) {
                await LocalDatabaseService.initDB(String(user.id));
            }

            // 2. Upload to Drive
            const fileName = path.split('/').pop() || `backup_${Date.now()}.zip`;
            await GoogleDriveService.uploadFile(path, fileName);

            const now = new Date().toLocaleString();
            await AsyncStorage.setItem(LAST_BACKUP_KEY, now);
            setLastBackup(now);

            Alert.alert("Success", `Backup uploaded to Google Drive successfully.`);
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRestoreFromDrive = async () => {
        try {
            setLoading(true);
            const userInfo = await handleGoogleSignIn();
            if (!userInfo) return;

            const backups = await GoogleDriveService.listBackups();
            if (backups.length === 0) {
                Alert.alert("No Backups", "No backups found in Google Drive.");
                return;
            }

            setDriveBackups(backups);
            setDrivePickerVisible(true);
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    };

    const selectDriveBackup = async (backup: any) => {
        setDrivePickerVisible(false);
        setSelectedDriveBackup(backup);
        setModalAction("restore_drive");
        setBackupPassword("");
        setPasswordModalVisible(true);
    };

    const submitRestoreFromDrive = async (password: string) => {
        if (!password || !selectedDriveBackup) return;

        try {
            setLoading(true);
            setPasswordModalVisible(false);

            const tempUri = `${FileSystem.cacheDirectory}temp_drive_restore.zip`;

            // 1. Download
            await GoogleDriveService.downloadFile(selectedDriveBackup.id, tempUri);

            // 2. Restore
            await BackupService.restoreBackup(tempUri, password);

            // Cleanup temp file
            await FileSystem.deleteAsync(tempUri, { idempotent: true });

            Alert.alert("Success", "Restore complete. The app will now restart to apply changes.", [
                { text: "OK", onPress: () => Updates.reloadAsync() }
            ]);
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
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
                    <TouchableOpacity
                        style={styles.actionItem}
                        onPress={handleBackupToDrive}
                        disabled={loading}
                    >
                        <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                            <Cloud color="#3b82f6" size={20} />
                        </View>
                        <View style={styles.actionText}>
                            <Text style={styles.actionTitle}>Backup to Google Drive</Text>
                            <Text style={styles.actionSubtitle}>Create and upload backup to your Google Drive.</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionItem}
                        onPress={handleRestoreFromDrive}
                        disabled={loading}
                    >
                        <View style={[styles.iconBox, { backgroundColor: '#fefce8' }]}>
                            <Download color="#ca8a04" size={20} />
                        </View>
                        <View style={styles.actionText}>
                            <Text style={styles.actionTitle}>Restore from Drive</Text>
                            <Text style={styles.actionSubtitle}>Download and restore a backup from Google Drive.</Text>
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

            <Modal
                transparent
                visible={passwordModalVisible}
                animationType="fade"
                onRequestClose={() => setPasswordModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            {modalAction === "create" || modalAction === "create_drive" ? "Create Backup Password" : "Enter Backup Password"}
                        </Text>
                        <Text style={styles.modalSubtitle}>
                            {modalAction === "create" || modalAction === "create_drive"
                                ? "This password will be used to encrypt your backup. Don't lose it!"
                                : "Provide the password used to encrypt this backup archive."}
                        </Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Min. 4 characters"
                            secureTextEntry
                            value={backupPassword}
                            onChangeText={setBackupPassword}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setPasswordModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.confirmButton]}
                                onPress={() => {
                                    if (modalAction === "create") submitCreateBackup(backupPassword);
                                    else if (modalAction === "restore") submitRestoreBackup(backupPassword);
                                    else if (modalAction === "create_drive") submitBackupToDrive(backupPassword);
                                    else if (modalAction === "restore_drive") submitRestoreFromDrive(backupPassword);
                                }}
                            >
                                <Text style={styles.confirmButtonText}>
                                    {modalAction === "create" || modalAction === "create_drive" ? "Create" : "Restore"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Drive Backups Picker Modal */}
            <Modal
                transparent
                visible={drivePickerVisible}
                animationType="slide"
                onRequestClose={() => setDrivePickerVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.drivePickerContent}>
                        <Text style={styles.modalTitle}>Select a Backup</Text>
                        <ScrollView style={{ maxHeight: 300, width: '100%', marginBottom: 16 }}>
                            {driveBackups.map((backup) => (
                                <TouchableOpacity
                                    key={backup.id}
                                    style={styles.driveBackupItem}
                                    onPress={() => selectDriveBackup(backup)}
                                >
                                    <Cloud color="#3b82f6" size={20} />
                                    <View style={{ marginLeft: 12 }}>
                                        <Text style={styles.driveBackupName}>{backup.name}</Text>
                                        <Text style={styles.driveBackupDate}>
                                            {new Date(backup.createdTime).toLocaleString()}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity
                            style={[styles.modalButton, styles.cancelButton, { width: '100%' }]}
                            onPress={() => setDrivePickerVisible(false)}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
    actionSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
    modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 20 },
    input: {
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    modalButtons: { flexDirection: 'row', gap: 12 },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButton: { backgroundColor: '#f1f5f9' },
    confirmButton: { backgroundColor: '#22c55e' },
    cancelButtonText: { color: '#64748b', fontWeight: '600' },
    confirmButtonText: { color: '#fff', fontWeight: '600' },
    drivePickerContent: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 380,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        alignItems: 'center',
    },
    driveBackupItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    driveBackupName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1e293b',
    },
    driveBackupDate: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    }
});
