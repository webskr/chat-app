import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Platform, Image, Modal, FlatList } from 'react-native';
import { Stack, router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { ThemedText } from '../../components/ThemedText';
import { useUser } from '../../context/UserContext';
import { Config } from '../../constants/Config';
import { Image as ImageIcon, Send, Clock, X, Calendar as CalendarIcon, ChevronDown } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

export default function ComposeBroadcastScreen() {
    const { user } = useUser();
    const [message, setMessage] = useState('');
    const [image, setImage] = useState<{ uri: string, type: string, fileName: string } | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [scheduledTime, setScheduledTime] = useState<Date | null>(null);

    // Schedule Modal State
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    // Dropdown State
    const [selectedDay, setSelectedDay] = useState<string>('');
    const [selectedHour, setSelectedHour] = useState<string>('');
    const [selectedMinute, setSelectedMinute] = useState<string>('');
    const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

    // Picker Modal State
    const [pickerType, setPickerType] = useState<'day' | 'hour' | 'minute' | null>(null);

    // Derived Preview State
    const [previewTime, setPreviewTime] = useState<Date | null>(null);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

    useEffect(() => {
        if (showScheduleModal) {
            // Reset or Set Defaults
            const now = new Date();
            setSelectedDay(days[now.getDay()]);
            let h = now.getHours();
            const m = now.getMinutes();
            const p = h >= 12 ? 'PM' : 'AM';
            h = h % 12;
            h = h ? h : 12; // the hour '0' should be '12'

            setSelectedHour(h.toString().padStart(2, '0'));
            setSelectedMinute(m.toString().padStart(2, '0'));
            setPeriod(p);
            setPreviewTime(null);
        }
    }, [showScheduleModal]);

    // Update preview whenever inputs change
    useEffect(() => {
        if (selectedDay && selectedHour && selectedMinute) {
            const now = new Date();
            const currentDayIndex = now.getDay(); // 0-6
            const targetDayIndex = days.indexOf(selectedDay);

            let daysToAdd = targetDayIndex - currentDayIndex;
            if (daysToAdd < 0) {
                daysToAdd += 7;
            }

            // Temporary date for time check
            let h = parseInt(selectedHour);
            const m = parseInt(selectedMinute);

            // Convert to 24h
            if (period === 'PM' && h !== 12) h += 12;
            else if (period === 'AM' && h === 12) h = 0;

            // First assumption: Target is 'daysToAdd' days away
            const targetDate = new Date(now);
            targetDate.setDate(now.getDate() + daysToAdd);
            targetDate.setHours(h, m, 0, 0);

            // Refinement Logic:
            // If daysToAdd is 0 (Today), and calculated time < now, then it must be Next Week (Today + 7).
            if (daysToAdd === 0 && targetDate < now) {
                targetDate.setDate(targetDate.getDate() + 7);
            }

            // Safety check: ensure we didn't somehow end up in the past (e.g. slight ms diffs)
            // If it's still in the past (unlikely with above logic unless time is exactly now),
            // implies user selected exactly now or few ms ago.
            // Let's accept strictly future.

            if (targetDate > now) {
                setPreviewTime(targetDate);
            } else {
                // Technically shouldn't happen with the +7 logic, but safe fallback
                setPreviewTime(null);
            }
        }
    }, [selectedDay, selectedHour, selectedMinute, period]);


    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            setImage({
                uri: asset.uri,
                type: asset.mimeType || 'image/jpeg',
                fileName: asset.fileName || `broadcast_${Date.now()}.jpg`
            });
        }
    };

    const confirmSchedule = () => {
        if (previewTime) {
            Alert.alert("Debug", `Setting Schedule: ${previewTime.toLocaleString()}`);
            setScheduledTime(previewTime);
            setShowScheduleModal(false);
        } else {
            Alert.alert("Invalid Time", "Please select a future time.");
        }
    };

    const handleSend = async () => {
        if (!message.trim() && !image) {
            Alert.alert("Error", "Please enter a message or select an image.");
            return;
        }

        setIsSending(true);

        try {
            Alert.alert("Debug", "Step 1: Uploading Image...");
            let imagePath = null;
            if (image) {
                // ... Image upload logic (omitted for brevity, same as before)
                try {
                    fetch(`${Config.API_URL}/client_log.php`, {
                        method: 'POST',
                        body: JSON.stringify({ event: 'upload_start', image: image })
                    });
                } catch (e) { }

                const formData = new FormData();
                const filename = image.fileName;
                if (Platform.OS === 'web') {
                    const response = await fetch(image.uri);
                    const blob = await response.blob();
                    formData.append('image', blob, filename);
                } else {
                    formData.append('image', {
                        uri: Platform.OS === 'android' ? image.uri : image.uri.replace('file://', ''),
                        name: filename,
                        type: image.type
                    } as any);
                }
                formData.append('sender_id', String(user?.id));
                formData.append('receiver_id', '0');

                const uploadRes = await fetch(`${Config.API_URL}/chat/upload_image.php`, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
                });

                const uploadText = await uploadRes.text();
                const uploadData = JSON.parse(uploadText);

                if (uploadRes.ok && uploadData.success) {
                    imagePath = uploadData.image_path;
                } else {
                    throw new Error("Image upload failed: " + (uploadData.message || uploadText));
                }
            }

            const payload = {
                sender_id: user?.id,
                message: message.trim(),
                image_path: imagePath,
                scheduled_at: scheduledTime ? scheduledTime.toISOString() : null
            };

            // DEBUG: Alert payload to verify schedule
            Alert.alert("Debug", `Step 2: Sending Payload. Sched: ${scheduledTime ? 'YES' : 'NO'}`);

            if (scheduledTime) {
                Alert.alert("Debug Payload", `Scheduled At: ${payload.scheduled_at}`);
            }

            console.log("Sending to:", `${Config.API_URL}/chat/send_broadcast.php`);
            Alert.alert("Debug", `Fetching: ${Config.API_URL}/chat/send_broadcast.php`);

            const response = await fetch(`${Config.API_URL}/chat/send_broadcast.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            Alert.alert("Debug", `Response Status: ${response.status}`);
            const data = await response.json();

            if (response.ok) {
                Alert.alert("Success", data.message, [
                    { text: "OK", onPress: () => router.back() }
                ]);
            } else {
                Alert.alert("Error", data.message || "Failed to send broadcast.");
            }

        } catch (error: any) {
            console.error(error);
            Alert.alert("Debug Error", `Msg: ${error.message}\nStack: ${error.stack}`);
        } finally {
            setIsSending(false);
        }
    };

    // Generic Picker Renderer
    const renderPicker = () => {
        if (!pickerType) return null;

        let data: string[] = [];
        let onSelect: (val: string) => void = () => { };

        if (pickerType === 'day') {
            data = days;
            onSelect = (val) => { setSelectedDay(val); setPickerType(null); };
        } else if (pickerType === 'hour') {
            data = hours;
            onSelect = (val) => { setSelectedHour(val); setPickerType(null); };
        } else if (pickerType === 'minute') {
            data = minutes;
            onSelect = (val) => { setSelectedMinute(val); setPickerType(null); };
        }

        return (
            <Modal transparent={true} visible={!!pickerType} animationType="fade">
                <TouchableOpacity style={styles.pickerOverlay} onPress={() => setPickerType(null)}>
                    <View style={styles.pickerContainer}>
                        <ThemedText style={styles.pickerTitle}>Select {pickerType.charAt(0).toUpperCase() + pickerType.slice(1)}</ThemedText>
                        <FlatList
                            data={data}
                            keyExtractor={(item) => item}
                            style={{ maxHeight: 300 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.pickerItem} onPress={() => onSelect(item)}>
                                    <ThemedText style={styles.pickerItemText}>{item}</ThemedText>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Broadcast', headerBackTitle: 'Cancel' }} />
            <ScrollView style={styles.content}>
                {scheduledTime && (
                    <View style={styles.scheduledPreview}>
                        <View style={styles.scheduledInfo}>
                            <Clock size={20} color={Colors.primary} />
                            <ThemedText style={styles.scheduledText}>
                                Scheduled: {scheduledTime.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </ThemedText>
                        </View>
                        <View style={styles.scheduledActions}>
                            <TouchableOpacity onPress={() => setShowScheduleModal(true)} style={styles.editScheduleButton}>
                                <ThemedText style={styles.editScheduleText}>Edit</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setScheduledTime(null)} style={styles.removeScheduleButton}>
                                <X size={20} color={Colors.error} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <ThemedText style={styles.label}>Message</ThemedText>
                <TextInput
                    style={styles.input}
                    multiline
                    placeholder="Type your announcement here..."
                    placeholderTextColor={Colors.textSecondary}
                    value={message}
                    onChangeText={setMessage}
                    maxLength={5000}
                />

                {image ? (
                    <View style={styles.imagePreview}>
                        <Image source={{ uri: image.uri }} style={styles.previewImage} />
                        <TouchableOpacity style={styles.removeImage} onPress={() => setImage(null)}>
                            <X size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity style={styles.attachButton} onPress={handlePickImage}>
                        <ImageIcon size={24} color={Colors.primary} />
                        <ThemedText style={styles.attachText}>Attach Image</ThemedText>
                    </TouchableOpacity>
                )}
                <View style={styles.divider} />
            </ScrollView>

            <View style={styles.footer}>
                <ThemedText style={styles.hintText}>This message will be sent to ALL users.</ThemedText>
                <View style={styles.footerButtons}>
                    <TouchableOpacity style={styles.scheduleButton} onPress={() => setShowScheduleModal(true)} disabled={isSending}>
                        <CalendarIcon size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.sendButton, (isSending || (!message.trim() && !image)) && styles.disabledButton]}
                        onPress={handleSend}
                        disabled={isSending || (!message.trim() && !image)}
                    >
                        <Send size={20} color="#fff" />
                        <ThemedText style={styles.sendButtonText}>
                            {isSending ? "Sending..." : (scheduledTime ? "Schedule Broadcast" : "Send Broadcast")}
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Main Schedule Modal */}
            <Modal
                visible={showScheduleModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowScheduleModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ThemedText style={styles.modalTitle}>Schedule Broadcast</ThemedText>
                        <ThemedText style={styles.modalSubtitle}>Select day and time</ThemedText>

                        <View style={styles.inputRow}>
                            {/* DAY PICKER */}
                            <View style={[styles.inputGroup, { flex: 1.5 }]}>
                                <ThemedText style={styles.inputLabel}>Day</ThemedText>
                                <TouchableOpacity style={styles.pickerTrigger} onPress={() => setPickerType('day')}>
                                    <ThemedText style={styles.pickerValue}>{selectedDay || 'Day'}</ThemedText>
                                    <ChevronDown size={14} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            {/* HOUR PICKER */}
                            <View style={styles.inputGroup}>
                                <ThemedText style={styles.inputLabel}>Hour</ThemedText>
                                <TouchableOpacity style={styles.pickerTrigger} onPress={() => setPickerType('hour')}>
                                    <ThemedText style={styles.pickerValue}>{selectedHour || '12'}</ThemedText>
                                    <ChevronDown size={14} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            {/* MINUTE PICKER */}
                            <View style={styles.inputGroup}>
                                <ThemedText style={styles.inputLabel}>Min</ThemedText>
                                <TouchableOpacity style={styles.pickerTrigger} onPress={() => setPickerType('minute')}>
                                    <ThemedText style={styles.pickerValue}>{selectedMinute || '00'}</ThemedText>
                                    <ChevronDown size={14} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            {/* AM/PM TOGGLE */}
                            <View style={styles.inputGroup}>
                                <ThemedText style={styles.inputLabel}>AM/PM</ThemedText>
                                <View style={styles.periodContainer}>
                                    <TouchableOpacity
                                        style={[styles.periodButton, period === 'AM' && styles.periodButtonActive]}
                                        onPress={() => setPeriod('AM')}
                                    >
                                        <ThemedText style={[styles.periodText, period === 'AM' && styles.periodTextActive]}>AM</ThemedText>
                                    </TouchableOpacity>
                                    <View style={styles.periodDivider} />
                                    <TouchableOpacity
                                        style={[styles.periodButton, period === 'PM' && styles.periodButtonActive]}
                                        onPress={() => setPeriod('PM')}
                                    >
                                        <ThemedText style={[styles.periodText, period === 'PM' && styles.periodTextActive]}>PM</ThemedText>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {previewTime ? (
                            <View style={styles.previewContainer}>
                                <ThemedText style={styles.previewLabel}>Scheduled For:</ThemedText>
                                <ThemedText style={styles.successText}>
                                    {previewTime.toLocaleString()}
                                </ThemedText>
                            </View>
                        ) : (
                            <ThemedText style={styles.previewPlaceholder}>
                                Invalid or Past Time
                            </ThemedText>
                        )}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.modalButtonCancel} onPress={() => setShowScheduleModal(false)}>
                                <ThemedText style={styles.modalButtonTextCancel}>Cancel</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButtonConfirm, !previewTime && styles.disabledButton]}
                                onPress={confirmSchedule}
                                disabled={!previewTime}
                            >
                                <ThemedText style={styles.modalButtonTextConfirm}>Set Time</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
                {/* Nested Picker Modal */}
                {renderPicker()}
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    content: { flex: 1, padding: 16 },
    label: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: Colors.text },
    input: { backgroundColor: Colors.surface, borderRadius: 12, padding: 12, color: Colors.text, fontSize: 16, minHeight: 150, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.glassBorder },
    attachButton: { flexDirection: 'row', alignItems: 'center', padding: 12, marginTop: 16, gap: 8 },
    attachText: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
    imagePreview: { marginTop: 16, position: 'relative', alignSelf: 'flex-start' },
    previewImage: { width: 150, height: 150, borderRadius: 8 },
    removeImage: { position: 'absolute', top: -8, right: -8, backgroundColor: Colors.error, borderRadius: 12, padding: 4 },
    divider: { height: 1, backgroundColor: Colors.glassBorder, marginVertical: 20 },
    scheduledPreview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: Colors.primary },
    scheduledInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    scheduledText: { color: Colors.primary, fontWeight: '600' },
    scheduledActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    editScheduleButton: { padding: 4 },
    editScheduleText: { color: Colors.primary, fontWeight: 'bold' },
    removeScheduleButton: { padding: 4 },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.glassBorder, backgroundColor: Colors.background },
    footerButtons: { flexDirection: 'row', gap: 12 },
    scheduleButton: { backgroundColor: Colors.surface, width: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: Colors.glassBorder },
    hintText: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginBottom: 12 },
    sendButton: { backgroundColor: Colors.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 12, gap: 8, flex: 1 },
    disabledButton: { opacity: 0.5 },
    sendButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: Colors.background, borderRadius: 20, padding: 20, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: Colors.glassBorder },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: Colors.text },
    modalSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 12 },
    modalButtonCancel: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: Colors.surface, alignItems: 'center' },
    modalButtonConfirm: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center' },
    modalButtonTextCancel: { color: Colors.text, fontWeight: '600' },
    modalButtonTextConfirm: { color: '#fff', fontWeight: '600' },
    inputRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 8 },
    inputGroup: { flex: 1, alignItems: 'center' },
    inputLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
    pickerTrigger: { width: '100%', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48 },
    pickerValue: { fontSize: 14, fontWeight: 'bold', color: Colors.text, flex: 1, textAlign: 'center' },
    successText: { color: Colors.primary, textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
    previewContainer: { marginBottom: 10, alignItems: 'center' },
    previewLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
    previewPlaceholder: { color: Colors.error, textAlign: 'center', fontSize: 14, marginBottom: 10 },
    periodContainer: { width: '100%', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.glassBorder, borderRadius: 12, height: 48, flexDirection: 'column', overflow: 'hidden' },
    periodButton: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    periodButtonActive: { backgroundColor: Colors.primary },
    periodDivider: { height: 1, backgroundColor: Colors.glassBorder, width: '100%' },
    periodText: { fontSize: 10, fontWeight: 'bold', color: Colors.textSecondary },
    periodTextActive: { color: '#fff' },
    pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    pickerContainer: { backgroundColor: Colors.surface, padding: 20, borderRadius: 16, width: 250, maxHeight: 400 },
    pickerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 10, textAlign: 'center' },
    pickerItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder },
    pickerItemText: { fontSize: 16, color: Colors.text, textAlign: 'center' }
});
