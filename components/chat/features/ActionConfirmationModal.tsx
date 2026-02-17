import React from 'react';
import { View, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { ThemedText } from '../../ThemedText';
import { Colors } from '../../../constants/Colors';

interface ActionConfirmationModalProps {
    visible: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
    onClose: () => void;
    icon?: React.ReactNode;
}

export const ActionConfirmationModal = ({
    visible,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
    onConfirm,
    onClose,
    icon
}: ActionConfirmationModalProps) => {
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
                        {icon && (
                            <View style={[styles.iconContainer, isDestructive && styles.destructiveIcon]}>
                                {icon}
                            </View>
                        )}
                        <ThemedText type="subtitle" style={styles.title}>{title}</ThemedText>
                    </View>

                    <ThemedText style={styles.description}>
                        {description}
                    </ThemedText>

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.button, isDestructive ? styles.destructiveButton : styles.confirmButton]}
                            onPress={onConfirm}
                        >
                            <ThemedText style={isDestructive ? styles.destructiveText : styles.confirmText}>
                                {confirmText}
                            </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
                            <ThemedText style={styles.cancelText}>{cancelText}</ThemedText>
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
    title: {
        textAlign: 'center',
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    destructiveIcon: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
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
    confirmButton: {
        backgroundColor: Colors.primary,
    },
    confirmText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    destructiveButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    destructiveText: {
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
