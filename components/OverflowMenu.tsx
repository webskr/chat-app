import React from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, TouchableWithoutFeedback, Dimensions } from 'react-native';
import { ThemedText } from './ThemedText';
import { Colors } from '../constants/Colors';
import { GlassCard } from './GlassCard';
import { LucideIcon } from 'lucide-react-native';

interface MenuItem {
    label: string;
    icon?: LucideIcon;
    onPress: () => void;
    destructive?: boolean;
    hidden?: boolean;
}

interface OverflowMenuProps {
    visible: boolean;
    onClose: () => void;
    items: MenuItem[];
    anchor?: { x: number; y: number };
}

export const OverflowMenu = ({ visible, onClose, items, anchor }: OverflowMenuProps) => {
    const filteredItems = items.filter(item => !item.hidden);

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <View style={[
                        styles.menuContainer,
                        anchor ? { top: anchor.y, right: Dimensions.get('window').width - anchor.x } : styles.defaultPosition
                    ]}>
                        <GlassCard intensity={40} style={styles.glassCard} contentContainerStyle={styles.glassContent}>
                            {filteredItems.map((item, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.menuItem,
                                        index < filteredItems.length - 1 && styles.borderBottom
                                    ]}
                                    onPress={() => {
                                        onClose();
                                        item.onPress();
                                    }}
                                >
                                    {item.icon && <item.icon size={18} color={item.destructive ? Colors.error : Colors.text} style={styles.icon} />}
                                    <ThemedText style={[
                                        styles.itemText,
                                        item.destructive && { color: Colors.error }
                                    ]}>
                                        {item.label}
                                    </ThemedText>
                                </TouchableOpacity>
                            ))}
                        </GlassCard>
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    menuContainer: {
        position: 'absolute',
        minWidth: 180,
        maxWidth: 240,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
    defaultPosition: {
        top: 60,
        right: 16,
    },
    glassCard: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        backgroundColor: 'rgba(20, 20, 20, 0.8)',
    },
    glassContent: {
        padding: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    borderBottom: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.glassBorder,
    },
    icon: {
        marginRight: 12,
    },
    itemText: {
        fontSize: 15,
        color: Colors.text,
    },
});
