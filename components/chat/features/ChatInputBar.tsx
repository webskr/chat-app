import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Keyboard, Animated, PanResponder, Platform, Dimensions, Alert } from 'react-native';
import { Smile, X, Paperclip, Send, Check, Mic, ChevronLeft, Trash2, Clock } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { GlassCard } from '../../../components/GlassCard';
import { ThemedText } from '../../../components/ThemedText';
import { SlashCommandSuggestions } from './SlashCommandSuggestions';
import { MentionSuggestions } from './MentionSuggestions'; // Import Mentions
import { InlineScheduleGuidance } from './InlineScheduleGuidance';
import { parseNaturalLanguageTime } from '../../../utils/timeParser';

const { width } = Dimensions.get('window');

export const ChatInputBar = ({
    inputText,
    editingMessage,
    handleTyping,
    handleAttachmentSelect,
    handlePickImage,
    handleSaveEdit,
    handleSend,
    handleCancelEdit,
    startRecording,
    stopRecording,
    cancelRecording,
    recordingStatus,
    recordingDuration,
    isPanelOpen,
    setIsPanelOpen,
    panelActiveTab,
    setPanelActiveTab,
    isAttachmentPanelOpen,
    setIsAttachmentPanelOpen,
    isUploading,
    isSending,
    inputRef,
    inputHeight,
    setInputHeight,
    keyboardHeight,
    onRequestSchedule,
    isGroup,
    userRole,
    permissions,
    groupMembers = [] // New prop: List of group members
}: any) => {



    // Schedule Logic State
    const [showSlashSuggestions, setShowSlashSuggestions] = useState(false);
    const [showScheduleGuidance, setShowScheduleGuidance] = useState(false);
    const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
    const [scheduleError, setScheduleError] = useState<string | null>(null);
    const [scheduleUsedText, setScheduleUsedText] = useState<string>('');

    // Mention Logic State
    const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);



    const handleTextChange = (text: string) => {
        handleTyping(text);

        // Slash Command Detection
        if (text === '/') {
            setShowSlashSuggestions(true);
            setShowScheduleGuidance(false);
            setShowMentionSuggestions(false);
        } else if (text.startsWith('/schedule')) {
            setShowSlashSuggestions(false);
            setShowScheduleGuidance(true);
            setShowMentionSuggestions(false);

            const timePart = text.replace('/schedule', '').trim();
            if (timePart) {
                const { date, error, usedText } = parseNaturalLanguageTime(timePart);
                setScheduledTime(date);
                setScheduleError(error || null);
                setScheduleUsedText(usedText || '');
            } else {
                setScheduledTime(null);
                setScheduleError(null);
                setScheduleUsedText('');
            }
        } else {
            setShowSlashSuggestions(false);
            setShowScheduleGuidance(false);
            setScheduledTime(null);
            setScheduleError(null);
            setScheduleUsedText('');

            // Mention Detection
            const lastAtSymbol = text.lastIndexOf('@');
            if (isGroup && lastAtSymbol !== -1 && lastAtSymbol >= cursorPosition - 20) { // Simple proximity check
                // Check if the @ is at the start or preceded by a space
                const charBefore = lastAtSymbol > 0 ? text[lastAtSymbol - 1] : ' ';
                if (charBefore === ' ' || charBefore === '\n') {
                    const query = text.slice(lastAtSymbol + 1);
                    // Check if query contains space (end of mention)
                    if (!query.includes(' ')) {
                        setMentionFilter(query);
                        setShowMentionSuggestions(true);
                        return;
                    }
                }
            }
            setShowMentionSuggestions(false);
        }
    };

    const handleSelectCommand = (cmd: string) => {
        handleTextChange(cmd);
    };

    const handleSelectMention = (username: string) => {
        const lastAtSymbol = inputText.lastIndexOf('@');
        if (lastAtSymbol !== -1) {
            const newText = inputText.slice(0, lastAtSymbol) + '@' + username + ' ';
            handleTyping(newText);
            setShowMentionSuggestions(false);
        }
    };

    const handleSendWithSchedule = () => {
        // ONE-TIME VIEW COMMAND
        if (inputText.startsWith('/otv')) {
            const content = inputText.replace('/otv', '').trim();
            if (content) {
                // Send as One-Time View
                // handleSend signature: (text, mediaPath, mediaType, isRetry, isOneTime, scheduledAt)
                handleSend(content, null, 'text', false, true);
            }
            return;
        }

        // SCHEDULE COMMAND
        if (scheduledTime && !scheduleError && inputText.startsWith('/schedule')) {
            // Extract message content by removing command and time
            // We know 'usedText' matches the time part.
            // But we need to be careful matching it in the full string if we didn't save it perfectly.
            // Using scheduleUsedText which we saved during parsing.

            const timePart = inputText.replace('/schedule', '').trim();
            // Remove the used time text from the timePart to get the message
            // This is a bit tricky if usedText is not unique, but usually sufficient.

            let messageContent = timePart;
            if (scheduleUsedText) {
                messageContent = timePart.replace(scheduleUsedText, '').trim();
            }

            onRequestSchedule(scheduledTime, messageContent); // Pass args to handler
        } else {
            handleSend(inputText);
        }
    };

    // Animation Values
    const micScale = useRef(new Animated.Value(1)).current;
    const micTranslateX = useRef(new Animated.Value(0)).current;
    const cancelOpacity = useRef(new Animated.Value(1)).current;
    const waveformAnim = useRef(new Animated.Value(0)).current;

    // Logic Refs & State
    const [isRecordingLocked, setIsRecordingLocked] = useState(false);
    const recordingStatusRef = useRef(recordingStatus);
    const isLockedRef = useRef(false);
    const gestureStartTimeRef = useRef(0);

    // Sync Refs
    recordingStatusRef.current = recordingStatus;
    isLockedRef.current = isRecordingLocked;

    // Reset lock state when recording stops
    useEffect(() => {
        if (recordingStatus !== 'recording') {
            setIsRecordingLocked(false);
        }
    }, [recordingStatus]);

    // Waveform Animation Loop
    useEffect(() => {
        if (recordingStatus === 'recording') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(waveformAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
                    Animated.timing(waveformAnim, { toValue: 0, duration: 500, useNativeDriver: true })
                ])
            ).start();
        } else {
            waveformAnim.setValue(0);
            resetAnimations();
        }
    }, [recordingStatus]);

    const resetAnimations = () => {
        Animated.parallel([
            Animated.spring(micScale, { toValue: 1, useNativeDriver: true }),
            Animated.spring(micTranslateX, { toValue: 0, useNativeDriver: true }),
            Animated.timing(cancelOpacity, { toValue: 1, duration: 200, useNativeDriver: true })
        ]).start();
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                // If already recording (locked or active), prevent restart
                if (recordingStatusRef.current === 'recording') {
                    return;
                }

                gestureStartTimeRef.current = Date.now();
                startRecording();
                Animated.spring(micScale, { toValue: 1.5, useNativeDriver: true }).start();
            },
            onPanResponderMove: (_, gestureState) => {
                // Only allow sliding left
                if (gestureState.dx < 0) {
                    micTranslateX.setValue(gestureState.dx);

                    // Fade out cancel text as we slide
                    const newOpacity = Math.max(0, 1 - Math.abs(gestureState.dx) / 150);
                    cancelOpacity.setValue(newOpacity);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                const duration = Date.now() - gestureStartTimeRef.current;

                if (recordingStatusRef.current === 'recording') {
                    // SLIDE TO CANCEL (Always priority)
                    if (gestureState.dx < -100) {
                        cancelRecording();
                        setIsRecordingLocked(false);
                        resetAnimations();
                        return;
                    }

                    if (isLockedRef.current) {
                        // LOCKED MODE: Tap to Stop & Send
                        stopRecording();
                        setIsRecordingLocked(false);
                        resetAnimations();
                        return;
                    }

                    // HOLD MODE Logic
                    if (duration < 500) {
                        // TAP detected (< 500ms) -> LOCK MODE
                        setIsRecordingLocked(true);
                        // Visual feedback: Scale down slightly to indicate "Hands Free"
                        Animated.spring(micScale, { toValue: 1, useNativeDriver: true }).start();
                    } else {
                        // HOLD detected (> 500ms) -> SEND
                        stopRecording();
                        resetAnimations();
                    }
                } else {
                    // Should rarely happen if startRecording worked
                    resetAnimations();
                }
            },
            onPanResponderTerminate: () => {
                if (recordingStatusRef.current === 'recording' && !isLockedRef.current) {
                    cancelRecording();
                }
                resetAnimations();
            }
        })
    ).current;

    const handleEmojiToggle = () => {
        if (isPanelOpen && panelActiveTab === 'emoji') {
            setIsPanelOpen(false);
        } else {
            setIsAttachmentPanelOpen(false);
            setPanelActiveTab('emoji');
            if (Platform.OS === 'ios') inputRef.current?.blur();
            Keyboard.dismiss();
            setIsPanelOpen(true);
        }
    };

    const handleAttachmentToggle = () => {
        if (isAttachmentPanelOpen) {
            setIsAttachmentPanelOpen(false);
        } else {
            setIsPanelOpen(false);
            Keyboard.dismiss();
            setIsAttachmentPanelOpen(true);
        }
    };

    const isInputAreaActive = inputText.trim() || editingMessage;
    const isRecording = recordingStatus === 'recording';

    const formatDuration = (seconds: number) => {
        const date = new Date(seconds * 1000);
        return date.toISOString().substr(14, 5);
    };

    const canSendMessage = !isGroup || (userRole === 'owner' || userRole === 'admin' || permissions.allow_member_send_messages);

    return (
        <View style={styles.inputArea}>
            {!canSendMessage ? (
                <GlassCard style={{ padding: 12, alignItems: 'center' }}>
                    <ThemedText style={{ color: Colors.textSecondary, textAlign: 'center' }}>
                        Only admins can send messages in this group.
                    </ThemedText>
                </GlassCard>
            ) : (
                <>
                    {showSlashSuggestions && (
                        <SlashCommandSuggestions
                            onSelect={handleSelectCommand}
                            onClose={() => setShowSlashSuggestions(false)}
                        />
                    )}
                    {showScheduleGuidance && (
                        <InlineScheduleGuidance
                            date={scheduledTime}
                            error={scheduleError}
                        />
                    )}
                    {showMentionSuggestions && (
                        <MentionSuggestions
                            members={groupMembers}
                            filter={mentionFilter}
                            onSelect={handleSelectMention}
                            onClose={() => setShowMentionSuggestions(false)}
                        />
                    )}

                    <View style={styles.inputWrapper}>
                        {recordingStatus === 'recording' ? (
                            <View style={styles.recordingContainer}>
                                <View style={styles.recordingInfo}>
                                    <View style={styles.recordingDot} />
                                    <ThemedText style={styles.timerText}>{formatDuration(recordingDuration)}</ThemedText>
                                    <View style={styles.waveformContainer}>
                                        <Animated.View style={[styles.waveformBar, { height: 16, opacity: waveformAnim }]} />
                                        <Animated.View style={[styles.waveformBar, { height: 24, opacity: waveformAnim }]} />
                                        <Animated.View style={[styles.waveformBar, { height: 12, opacity: waveformAnim }]} />
                                        <Animated.View style={[styles.waveformBar, { height: 20, opacity: waveformAnim }]} />
                                    </View>
                                </View>
                                <View style={styles.slideCancelContainer}>
                                    <ChevronLeft size={16} color={Colors.textSecondary} />
                                    <Animated.Text style={[styles.slideCancelText, { opacity: cancelOpacity }]}>Slide to cancel</Animated.Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.inputContent}>
                                <TouchableOpacity onPress={handleEmojiToggle} style={styles.iconButton}>
                                    <View style={styles.micIconContainer}>
                                        <Smile size={22} color={panelActiveTab === 'emoji' && isPanelOpen ? Colors.primary : Colors.text} />
                                    </View>
                                </TouchableOpacity>

                                <TextInput
                                    ref={inputRef}
                                    style={[styles.input, { height: Math.max(40, Math.min(40, inputHeight)) }]}
                                    value={inputText}
                                    onChangeText={handleTextChange}
                                    onSelectionChange={(e) => setCursorPosition(e.nativeEvent.selection.start)}
                                    placeholder="Message..."
                                    placeholderTextColor={Colors.textSecondary}
                                    multiline
                                    onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height)}
                                    onFocus={() => { setIsPanelOpen(false); setIsAttachmentPanelOpen(false); }}
                                />

                                <TouchableOpacity onPress={handleAttachmentToggle} style={styles.iconButton}>
                                    <View style={styles.micIconContainer}>
                                        <Paperclip size={22} color={isAttachmentPanelOpen ? Colors.primary : Colors.text} />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        )}

                        {recordingStatus !== 'recording' && <View style={styles.verticalDivider} />}

                        {isInputAreaActive || (recordingStatus === 'recording' && isRecordingLocked) ? (
                            <TouchableOpacity
                                onPress={recordingStatus === 'recording' ? stopRecording : handleSendWithSchedule}
                                style={styles.iconButton}
                            >
                                <View style={styles.micIconContainer}>
                                    <Send size={22} color={Colors.primary} />
                                </View>
                            </TouchableOpacity>
                        ) : (
                            <Animated.View
                                style={[styles.iconButton, { transform: [{ scale: micScale }, { translateX: micTranslateX }] }]}
                                {...panResponder.panHandlers}
                            >
                                <View style={styles.micIconContainer}>
                                    <Mic size={22} color={Colors.text} />
                                </View>
                            </Animated.View>
                        )}
                    </View>
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    inputArea: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: Colors.background, // Ensure background matches
    },
    inputWrapper: {
        borderRadius: 24, // Keep rounded
        overflow: 'hidden',
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 2, // Reduced wrapper padding
    },
    inputContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        paddingVertical: 2, // Reduced content padding
        minHeight: 40, // Reduced minHeight from 50
        flex: 1,
    },
    recordingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flex: 1,
        paddingHorizontal: 10,
        height: 40, // Match new minHeight
    },
    recordingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    recordingDot: {
        width: 8, // Slightly smaller dot
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.error,
        marginRight: 4,
    },
    timerText: {
        fontSize: 14, // Slightly smaller text
        fontWeight: '600',
        color: Colors.text,
        minWidth: 45,
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2, // tighter gap
        height: 20, // smaller waveform
        marginLeft: 8,
    },
    waveformBar: {
        width: 2, // thinner bars
        backgroundColor: Colors.textSecondary,
        borderRadius: 1,
    },
    slideCancelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10,
    },
    slideCancelText: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginLeft: 4,
    },
    iconButton: {
        padding: 4, // Reduced button padding
    },
    input: {
        flex: 1,
        color: Colors.text,
        fontSize: 16,
        maxHeight: 80, // Reduced max height slightly
        paddingVertical: 0,
        paddingHorizontal: 8,
        textAlignVertical: 'center',
    },
    verticalDivider: {
        width: 1,
        height: 20, // Match new height scale
        backgroundColor: Colors.glassBorder,
        marginHorizontal: 2, // Tighter margin
    },
    micIconContainer: {
        width: 32, // Slightly smaller touch target visual
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
});

