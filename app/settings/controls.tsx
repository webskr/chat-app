import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, LayoutAnimation, UIManager, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { useUser } from '../../context/UserContext';
import { Config } from '../../constants/Config';
import { ChevronLeft, Check, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react-native';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const AUTO_DELETE_OPTIONS = [
    { label: 'Off', value: 0 },
    { label: '10 Minutes', value: 10 },
    { label: '24 Hours', value: 1440 },
    { label: '7 Days', value: 10080 },
    { label: '30 Days', value: 43200 },
    { label: '90 Days', value: 129600 },
];

export default function ControlsScreen() {
    const { user, setUser } = useUser();
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const { scrollTo } = useLocalSearchParams<{ scrollTo?: string }>();
    const scrollRef = useRef<ScrollView>(null);
    const sectionsRef = useRef<Record<string, number>>({});

    useEffect(() => {
        if (scrollTo && sectionsRef.current[scrollTo] !== undefined) {
            setTimeout(() => {
                scrollRef.current?.scrollTo({ y: sectionsRef.current[scrollTo], animated: true });
            }, 500);
        }
    }, [scrollTo]);

    const toggleDropdown = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsDropdownOpen(!isDropdownOpen);
    };

    const updateGlobalAutoDelete = async (minutes: number) => {
        if (!user) return;

        // Optimistic update
        const prevValue = user.global_auto_delete_minutes;
        setUser({ ...user, global_auto_delete_minutes: minutes });

        // Close dropdown and animate
        if (isDropdownOpen) {
            toggleDropdown();
        }

        setIsUpdating(true);
        try {
            const response = await fetch(`${Config.API_URL}/chat/update_global_chat_settings.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    auto_delete_minutes: minutes
                }),
            });

            if (response.ok) {
                if (Platform.OS === 'web') alert('Settings updated');
            } else {
                // Revert on failure
                setUser({ ...user, global_auto_delete_minutes: prevValue });
                Alert.alert('Error', 'Failed to update settings.');
            }
        } catch (error) {
            console.error('Global auto-delete error:', error);
            // Revert on failure
            setUser({ ...user, global_auto_delete_minutes: prevValue });
            Alert.alert('Error', 'Network error.');
        } finally {
            setIsUpdating(false);
        }
    };

    const updateNameScramble = async (enabled: boolean, forceRefresh: boolean = false) => {
        if (!user) return;

        // If it's already enabled and we're just toggling OFF, no need to refresh scramble_value
        // If we want to refresh specifically, we pass forceRefresh = true.

        const prevValue = (user as any).scramble_name;
        
        // If forceRefresh is true, we keep scramble_name enabled but tell the backend to rotate
        if (!forceRefresh) {
            setUser({ ...user, scramble_name: enabled ? 1 : 0 } as any);
        }

        setIsUpdating(true);
        try {
            const response = await fetch(`${Config.API_URL}/chat/update_global_chat_settings.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    scramble_name: forceRefresh ? true : enabled // Always send true to backend to trigger new value if forceRefresh
                }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.scramble_value) {
                    setUser({ ...user, scramble_name: forceRefresh ? 1 : (enabled ? 1 : 0), scramble_value: data.scramble_value } as any);
                } else if (!forceRefresh) {
                    setUser({ ...user, scramble_name: enabled ? 1 : 0 } as any);
                }

                if (forceRefresh || enabled) {
                     if (Platform.OS === 'web') alert('Identity scrambled!');
                     else Alert.alert('Success', 'New scrambled name generated.');
                }
            } else {
                if (!forceRefresh) setUser({ ...user, scramble_name: prevValue } as any);
                Alert.alert('Error', 'Failed to update settings.');
            }
        } catch (error) {
            console.error('Scramble update error:', error);
            if (!forceRefresh) setUser({ ...user, scramble_name: prevValue } as any);
        } finally {
            setIsUpdating(false);
        }
    };

    const updatePrivacySetting = async (key: string, value: any) => {
        if (!user) return;

        // Map boolean to 1/0 for numeric settings
        const processedValue = typeof value === 'boolean' ? (value ? 1 : 0) : value;

        // Optimistic update
        const prevValue = (user as any)[key];
        setUser({ ...user, [key]: processedValue } as any);

        setIsUpdating(true);
        try {
            const response = await fetch(`${Config.API_URL}/chat/update_global_chat_settings.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    [key]: processedValue
                }),
            });

            if (!response.ok) {
                // Revert on failure
                setUser({ ...user, [key]: prevValue } as any);
                Alert.alert('Error', 'Failed to update privacy setting.');
            }
        } catch (error) {
            console.error(`Privacy update error (${key}):`, error);
            setUser({ ...user, [key]: prevValue } as any);
            Alert.alert('Error', 'Network error.');
        } finally {
            setIsUpdating(false);
        }
    };

    const currentOption = AUTO_DELETE_OPTIONS.find(o => o.value === (user?.global_auto_delete_minutes || 0)) || AUTO_DELETE_OPTIONS[0];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ChevronLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <ThemedText type="title" style={styles.headerTitle}>Controls</ThemedText>
            </View>

            <ScrollView 
                ref={scrollRef}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >

                {/* Privacy Controls Section */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Privacy Controls</ThemedText>
                    <ThemedText style={styles.description}>
                        Manage who can see your activity and profile details.
                    </ThemedText>

                    <View style={styles.controlContainer}>
                        {/* Last Seen Toggle */}
                        <View style={styles.switchRow}>
                            <View style={styles.settingTextContainer}>
                                <ThemedText style={styles.settingLabel}>Last Seen</ThemedText>
                                <ThemedText style={styles.settingCaption}>Show your last active time to others.</ThemedText>
                            </View>
                            <Switch
                                value={user?.privacy_last_seen !== 0}
                                onValueChange={(val) => updatePrivacySetting('privacy_last_seen', val)}
                                trackColor={{ false: Colors.surfaceLight, true: Colors.primary }}
                                thumbColor={Colors.white}
                                disabled={isUpdating}
                            />
                        </View>
                        <View style={styles.innerDivider} />

                        {/* Read Receipts Toggle */}
                        <View style={styles.switchRow}>
                            <View style={styles.settingTextContainer}>
                                <ThemedText style={styles.settingLabel}>Read Receipts</ThemedText>
                                <ThemedText style={styles.settingCaption}>Allow others to see when you've read messages.</ThemedText>
                            </View>
                            <Switch
                                value={user?.privacy_read_receipts !== 0}
                                onValueChange={(val) => updatePrivacySetting('privacy_read_receipts', val)}
                                trackColor={{ false: Colors.surfaceLight, true: Colors.primary }}
                                thumbColor={Colors.white}
                                disabled={isUpdating}
                            />
                        </View>
                        <View style={styles.innerDivider} />

                        {/* Profile Visibility Toggle */}
                        <View style={styles.switchRow}>
                            <View style={styles.settingTextContainer}>
                                <ThemedText style={styles.settingLabel}>Private Profile</ThemedText>
                                <ThemedText style={styles.settingCaption}>Hide your bio and avatar from non-friends.</ThemedText>
                            </View>
                            <Switch
                                value={user?.privacy_profile_visibility === 'private'}
                                onValueChange={(val) => updatePrivacySetting('privacy_profile_visibility', val ? 'private' : 'public')}
                                trackColor={{ false: Colors.surfaceLight, true: Colors.primary }}
                                thumbColor={Colors.white}
                                disabled={isUpdating}
                            />
                        </View>
                        <View style={styles.innerDivider} />

                        {/* Show in World Toggle */}
                        <View style={styles.switchRow}>
                            <View style={styles.settingTextContainer}>
                                <ThemedText style={styles.settingLabel}>Show in World</ThemedText>
                                <ThemedText style={styles.settingCaption}>Allow others to discover your profile in the World list.</ThemedText>
                            </View>
                            <Switch
                                value={user?.show_in_world !== 0}
                                onValueChange={(val) => updatePrivacySetting('show_in_world', val)}
                                trackColor={{ false: Colors.surfaceLight, true: Colors.primary }}
                                thumbColor={Colors.white}
                                disabled={isUpdating}
                            />
                        </View>
                        <View style={styles.innerDivider} />

                        {/* OTV Auto-Delete Toggle */}
                        <View style={styles.switchRow}>
                            <View style={styles.settingTextContainer}>
                                <ThemedText style={styles.settingLabel}>Auto-delete Sent OTV</ThemedText>
                                <ThemedText style={styles.settingCaption}>Automatically delete one-time messages you send 5 minutes after they are opened.</ThemedText>
                            </View>
                            <Switch
                                value={!!user?.auto_delete_otv}
                                onValueChange={(val) => updatePrivacySetting('auto_delete_otv', val)}
                                trackColor={{ false: Colors.surfaceLight, true: Colors.primary }}
                                thumbColor={Colors.white}
                                disabled={isUpdating}
                            />
                        </View>
                    </View>
                </View>

                {/* Auto Delete Section */}
                <View 
                    style={styles.section}
                    onLayout={(e) => {
                        sectionsRef.current['chat-management'] = e.nativeEvent.layout.y;
                    }}
                >
                    <ThemedText style={styles.sectionTitle}>Chat Management</ThemedText>
                    <ThemedText style={styles.description}>
                        Control how long messages stay in your account. Messages older than the selected time will be automatically hidden for you. This does not affect the recipient's view.
                    </ThemedText>

                    <View style={styles.controlContainer}>
                        {/* Individual Chat Toggle */}
                        <View style={styles.switchRow}>
                            <View style={styles.settingTextContainer}>
                                <ThemedText style={styles.settingLabel}>Individual Chats</ThemedText>
                                <ThemedText style={styles.settingCaption}>Apply auto-delete to 1-on-1 conversations.</ThemedText>
                            </View>
                            <Switch
                                value={user?.global_auto_delete_individual !== 0}
                                onValueChange={(val) => updatePrivacySetting('global_auto_delete_individual', val)}
                                trackColor={{ false: Colors.surfaceLight, true: Colors.primary }}
                                thumbColor={Colors.white}
                                disabled={isUpdating}
                            />
                        </View>
                        <View style={styles.innerDivider} />

                        {/* Group Chat Toggle */}
                        <View style={styles.switchRow}>
                            <View style={styles.settingTextContainer}>
                                <ThemedText style={styles.settingLabel}>Group Chats</ThemedText>
                                <ThemedText style={styles.settingCaption}>Apply auto-delete to group conversations.</ThemedText>
                            </View>
                            <Switch
                                value={user?.global_auto_delete_group !== 0}
                                onValueChange={(val) => updatePrivacySetting('global_auto_delete_group', val)}
                                trackColor={{ false: Colors.surfaceLight, true: Colors.primary }}
                                thumbColor={Colors.white}
                                disabled={isUpdating}
                            />
                        </View>
                        <View style={styles.innerDivider} />

                        <TouchableOpacity
                            style={[styles.dropdownHeader, isDropdownOpen && styles.dropdownHeaderOpen]}
                            onPress={toggleDropdown}
                            activeOpacity={0.7}
                        >
                            <ThemedText style={styles.settingLabel}>Auto-Delete</ThemedText>
                            <View style={styles.rowRight}>
                                <ThemedText style={styles.settingValue}>{currentOption.label}</ThemedText>
                                {isDropdownOpen ? (
                                    <ChevronUp size={20} color={Colors.textSecondary} />
                                ) : (
                                    <ChevronDown size={20} color={Colors.textSecondary} />
                                )}
                            </View>
                        </TouchableOpacity>

                        {isDropdownOpen && (
                            <View style={styles.optionsList}>
                                {AUTO_DELETE_OPTIONS.map((option) => (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={styles.optionItem}
                                        onPress={() => updateGlobalAutoDelete(option.value)}
                                        disabled={isUpdating}
                                    >
                                        <ThemedText style={styles.optionLabel}>
                                            {option.label}
                                        </ThemedText>
                                        {(user?.global_auto_delete_minutes || 0) === option.value && (
                                            <Check size={20} color={Colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                </View>

                {/* Name Scramble Section */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Extra Privacy</ThemedText>
                    <ThemedText style={styles.description}>
                        Scramble your name for users who are not in your friends list. Your friends will still see your real name.
                    </ThemedText>

                    <View style={styles.controlContainer}>
                        <View style={styles.switchRow}>
                            <View style={styles.settingTextContainer}>
                                <ThemedText style={styles.settingLabel}>Name Scramble</ThemedText>
                                <ThemedText style={styles.settingCaption}>Rotate identity for non-friends.</ThemedText>
                                {!!(user as any)?.scramble_name && (user as any)?.scramble_value && (
                                    <View style={styles.previewBadge}>
                                        <ThemedText style={styles.previewText}>
                                            Current: {(user as any).scramble_value}
                                        </ThemedText>
                                    </View>
                                )}
                            </View>
                            <View style={styles.rowRight}>
                                {!!(user as any)?.scramble_name && (
                                    <TouchableOpacity 
                                        onPress={() => updateNameScramble(true, true)}
                                        style={styles.reloadButton}
                                        disabled={isUpdating}
                                    >
                                        <RotateCcw size={20} color={Colors.primary} />
                                    </TouchableOpacity>
                                )}
                                <Switch
                                    value={!!(user as any)?.scramble_name}
                                    onValueChange={(val) => updateNameScramble(val)}
                                    trackColor={{ false: Colors.surfaceLight, true: Colors.primary }}
                                    thumbColor={Colors.white}
                                    disabled={isUpdating}
                                />
                            </View>
                        </View>
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.glassBorder,
    },
    backButton: {
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        padding: 20,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
        color: Colors.text,
    },
    description: {
        color: Colors.textSecondary,
        marginBottom: 16,
        lineHeight: 20,
    },
    controlContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    dropdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    dropdownHeaderOpen: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    settingLabel: {
        fontSize: 16,
        color: Colors.text,
        fontWeight: '500',
    },
    settingTextContainer: {
        flex: 1,
        marginRight: 10,
    },
    settingCaption: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    innerDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginLeft: 16,
    },
    rowRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    settingValue: {
        fontSize: 16,
        color: Colors.primary,
    },
    optionsList: {
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    optionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    optionLabel: {
        fontSize: 15,
        color: Colors.textSecondary,
    },
    reloadButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    previewBadge: {
        marginTop: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    previewText: {
        fontSize: 12,
        color: Colors.primary,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
});
