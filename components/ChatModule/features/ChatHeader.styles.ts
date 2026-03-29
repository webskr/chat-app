import { StyleSheet } from 'react-native';
import { Colors } from '../../../constants/Colors';

export const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.glassBorder,
        backgroundColor: Colors.background,
    },
    selectionHeader: {
        justifyContent: 'space-between',
        backgroundColor: Colors.surface, // Slightly different bg for selection mode?
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    rightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    iconButton: {
        padding: 4,
    },
    selectionTitle: {
        fontSize: 18,
    },
    backButton: {
        marginRight: 12,
    },
    headerInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    nameContainer: {
        gap: 2,
    },
    moreButton: {
        padding: 4,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flex: 1,
    },
    username: {
        fontSize: 16,
        flexShrink: 1,
    },
});
