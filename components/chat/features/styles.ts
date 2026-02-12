import { StyleSheet } from 'react-native';
import { Colors } from '../../../constants/Colors';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    listContent: {
        paddingVertical: 20,
        gap: 2,
    },
    inputContainer: {
        width: '100%',
        backgroundColor: Colors.background,
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
