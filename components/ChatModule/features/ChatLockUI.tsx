import React from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Modal } from 'react-native';
import { Lock } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { ThemedText } from '../../../components/ThemedText';

export const ChatLockScreen = ({ unlockPin, setUnlockPin, handleEntryUnlock }: any) => (
    <View style={styles.lockScreenContainer}>
        <Lock size={64} color={Colors.primary} style={styles.lockIcon} />
        <ThemedText type="subtitle" style={styles.lockTitle}>Chat Locked</ThemedText>
        <ThemedText style={styles.lockSubtitle}>Enter PIN to view this chat</ThemedText>

        <TextInput
            style={styles.pinInput}
            placeholder="Enter PIN"
            placeholderTextColor={Colors.textSecondary}
            value={unlockPin}
            onChangeText={setUnlockPin}
            keyboardType="numeric"
            secureTextEntry
            maxLength={4}
            onSubmitEditing={handleEntryUnlock}
            autoFocus
        />
        <TouchableOpacity style={styles.unlockButton} onPress={handleEntryUnlock}>
            <ThemedText style={styles.unlockButtonText}>Unlock</ThemedText>
        </TouchableOpacity>
    </View>
);

export const LockSetupModal = ({ visible, onClose, lockPin, setLockPin, onConfirm }: any) => (
    <Modal
        transparent={true}
        visible={visible}
        animationType="fade"
        onRequestClose={onClose}
    >
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: Colors.surface, borderColor: Colors.glassBorder }]}>
                <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Set Chat PIN</ThemedText>
                <ThemedText style={{ color: Colors.textSecondary, marginBottom: 15, textAlign: 'center' }}>
                    Create a secure PIN to lock this chat context.
                </ThemedText>

                <TextInput
                    style={[styles.pinInput, { marginBottom: 20 }]}
                    placeholder="Enter 4-digit PIN"
                    placeholderTextColor={Colors.textSecondary}
                    value={lockPin}
                    onChangeText={setLockPin}
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={4}
                    autoFocus
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={[styles.modalOption, styles.modalCancel, { flex: 1 }]} onPress={onClose}>
                        <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modalOption, { backgroundColor: Colors.primary, flex: 1, justifyContent: 'center' }]}
                        onPress={onConfirm}
                    >
                        <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Lock Chat</ThemedText>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    </Modal>
);

export const UnlockPromptModal = ({ visible, onClose, unlockPin, setUnlockPin, onConfirm }: any) => (
    <Modal
        transparent={true}
        visible={visible}
        animationType="fade"
        onRequestClose={onClose}
    >
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: Colors.surface, borderColor: Colors.glassBorder }]}>
                <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Authentication Required</ThemedText>
                <ThemedText style={{ color: Colors.textSecondary, marginBottom: 15, textAlign: 'center' }}>
                    Enter PIN to unlock settings.
                </ThemedText>
                <TextInput
                    style={[styles.pinInput, { marginBottom: 20 }]}
                    placeholder="Enter PIN"
                    placeholderTextColor={Colors.textSecondary}
                    value={unlockPin}
                    onChangeText={setUnlockPin}
                    keyboardType="numeric"
                    secureTextEntry
                    maxLength={4}
                    autoFocus
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={[styles.modalOption, styles.modalCancel, { flex: 1 }]} onPress={onClose}>
                        <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modalOption, { backgroundColor: Colors.primary, flex: 1, justifyContent: 'center' }]}
                        onPress={onConfirm}
                    >
                        <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Verify</ThemedText>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    </Modal>
);

const styles = StyleSheet.create({
    lockScreenContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: Colors.background,
    },
    lockIcon: {
        marginBottom: 20,
    },
    lockTitle: {
        marginBottom: 10,
    },
    lockSubtitle: {
        color: Colors.textSecondary,
        marginBottom: 30,
        textAlign: 'center',
    },
    pinInput: {
        width: '100%',
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        borderRadius: 12,
        padding: 16,
        fontSize: 20,
        color: Colors.text,
        textAlign: 'center',
        marginBottom: 20,
        letterSpacing: 4,
    },
    unlockButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 25,
    },
    unlockButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        gap: 12,
    },
    modalTitle: {
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 10,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        paddingVertical: 14,
        paddingHorizontal: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
    },
    modalOptionText: {
        fontSize: 16,
        color: Colors.text,
        fontWeight: '500',
    },
    modalCancel: {
        backgroundColor: 'transparent',
        justifyContent: 'center',
        marginTop: 5,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    modalCancelText: {
        fontSize: 16,
        color: Colors.textSecondary,
    },
});
