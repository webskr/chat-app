import { StyleSheet } from 'react-native';
import { Colors } from '../../../constants/Colors';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    listContent: {
        paddingVertical: 20,
    },
    inputContainer: {
        width: '100%',
        backgroundColor: Colors.background,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
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
    blockedFooter: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.surface,
        borderTopWidth: 1,
        borderTopColor: Colors.glassBorder,
        gap: 12,
        paddingBottom: 40,
    },
    blockedText: {
        fontSize: 16,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    unblockButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unblockText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
