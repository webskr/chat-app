import React from 'react';
import { View, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { ThemedText } from '../../ThemedText';
import { Colors } from '../../../constants/Colors';
import { Trash2 } from 'lucide-react-native';

interface DeleteConfirmationModalProps {
    visible: boolean;
    onClose: () => void;
    onDeleteForMe: () => void;
    onDeleteForEveryone?: () => void;
    count: number;
    canDeleteForEveryone: boolean;
}

export const DeleteConfirmationModal = ({
    visible,
    onClose,
    onDeleteForMe,
    onDeleteForEveryone,
    count,
    canDeleteForEveryone
}: DeleteConfirmationModalProps) => {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <BlurView intensity={40} tint="dark" style={styles.content}>
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <Trash2 size={24} color="#EF4444" />
                        </View>
                        <ThemedText type="subtitle">Delete {count} Message{count > 1 ? 's' : ''}?</ThemedText>
                    </View>

                    <ThemedText style={styles.description}>
                        Are you sure you want to delete {count > 1 ? 'these messages' : 'this message'}?
                        This action cannot be undone.
                    </ThemedText>

                    <View style={styles.actions}>
                        {canDeleteForEveryone && onDeleteForEveryone && (
                            <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={onDeleteForEveryone}>
                                <ThemedText style={styles.deleteText}>Delete for Everyone</ThemedText>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={onDeleteForMe}>
                            <ThemedText style={styles.deleteText}>Delete for Me</ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
                            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
                        </TouchableOpacity>
                    </View>
                </BlurView>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        overflow: 'hidden',
        backgroundColor: 'rgba(30, 30, 30, 0.7)',
    },
    header: {
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    description: {
        textAlign: 'center',
        color: Colors.textSecondary,
        marginBottom: 24,
        lineHeight: 20,
    },
    actions: {
        gap: 10,
        width: '100%',
    },
    button: {
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    deleteText: {
        color: '#EF4444',
        fontWeight: 'bold',
        fontSize: 16,
    },
    cancelButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    cancelText: {
        color: Colors.text,
        fontWeight: '600',
    },
});
