import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { ThemedText } from '../../../components/ThemedText';
import { Colors } from '../../../constants/Colors';
import { GlassCard } from '../../../components/GlassCard';
import { Calendar, Clock, ArrowRight, X } from 'lucide-react-native';

interface ScheduleConfirmationModalProps {
    visible: boolean;
    scheduledTime: Date | null;
    messageText: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ScheduleConfirmationModal: React.FC<ScheduleConfirmationModalProps> = ({
    visible,
    scheduledTime,
    messageText,
    onConfirm,
    onCancel
}) => {
    if (!visible || !scheduledTime) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onCancel}
        >
            <TouchableWithoutFeedback onPress={onCancel}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.modalContainer}>
                            <GlassCard intensity={80} style={styles.card}>
                                <View style={styles.header}>
                                    <View style={styles.iconCircle}>
                                        <Calendar size={24} color={Colors.primary} />
                                    </View>
                                    <ThemedText style={styles.title}>Schedule Message?</ThemedText>
                                    <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
                                        <X size={20} color={Colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.details}>
                                    <View style={styles.timeRow}>
                                        <Clock size={16} color={Colors.textSecondary} />
                                        <ThemedText style={styles.timeText}>
                                            {scheduledTime.toLocaleDateString()} at {scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </ThemedText>
                                    </View>

                                    <View style={styles.messagePreview}>
                                        <ThemedText style={styles.messageText} numberOfLines={3}>
                                            "{messageText}"
                                        </ThemedText>
                                    </View>
                                </View>

                                <View style={styles.actions}>
                                    <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                                        <ThemedText style={styles.cancelText}>Cancel</ThemedText>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
                                        <ThemedText style={styles.confirmText}>Schedule</ThemedText>
                                        <ArrowRight size={18} color="#FFF" />
                                    </TouchableOpacity>
                                </View>
                            </GlassCard>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 340,
    },
    card: {
        borderRadius: 24,
        padding: 24,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
        position: 'relative',
    },
    closeButton: {
        position: 'absolute',
        right: -8,
        top: -8,
        padding: 8,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    details: {
        marginBottom: 24,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 16,
        backgroundColor: Colors.background,
        padding: 10,
        borderRadius: 12,
    },
    timeText: {
        fontSize: 16,
        color: Colors.primary,
        fontWeight: '600',
    },
    messagePreview: {
        padding: 12,
        borderRadius: 12,
        backgroundColor: Colors.background,
        borderLeftWidth: 3,
        borderLeftColor: Colors.primary,
    },
    messageText: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontStyle: 'italic',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.background,
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    confirmButton: {
        flex: 1.5,
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
    },
    confirmText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
    },
});
