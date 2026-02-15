import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Keyboard, Animated, PanResponder, Platform, Dimensions, Alert } from 'react-native';
import { Smile, X, Paperclip, Send, Check, Mic, ChevronLeft, Trash2, Clock } from 'lucide-react-native';
import { Colors } from '../../../constants/Colors';
import { GlassCard } from '../../../components/GlassCard';
import { ThemedText } from '../../../components/ThemedText';
import { SlashCommandSuggestions } from './SlashCommandSuggestions';
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
    setInputHeight,
    keyboardHeight,
    onRequestSchedule, // New prop
}: any) => {

    // Schedule Logic State
    const [showSlashSuggestions, setShowSlashSuggestions] = useState(false);
    const [showScheduleGuidance, setShowScheduleGuidance] = useState(false);
    const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
    const [scheduleError, setScheduleError] = useState<string | null>(null);

    const handleTextChange = (text: string) => {
        handleTyping(text);

        // Slash Command Detection
        if (text === '/') {
            setShowSlashSuggestions(true);
            setShowScheduleGuidance(false);
        } else if (text.startsWith('/schedule')) {
            setShowSlashSuggestions(false);
            setShowScheduleGuidance(true);

            const timePart = text.replace('/schedule', '').trim();
            if (timePart) {
                const { date, error } = parseNaturalLanguageTime(timePart);
                setScheduledTime(date);
                setScheduleError(error || null);
            } else {
                setScheduledTime(null);
                setScheduleError(null);
            }
        } else {
            setShowSlashSuggestions(false);
            setShowScheduleGuidance(false);
            setScheduledTime(null);
            setScheduleError(null);
        }
    };

    const handleSelectCommand = (cmd: string) => {
        handleTextChange(cmd);
    };

    const handleSendWithSchedule = () => {
        if (scheduledTime && !scheduleError && inputText.replace('/schedule', '').trim()) {
            const cleanText = inputText.replace(/^\/schedule\s+.*?\s+/, '').trim() || inputText.replace('/schedule', '').trim();
            // We need to extract the message content logic better
            // Pattern: /schedule [time] [message]
            // We don't strictly separate them in parser, parser just grabs time.
            // Let's rely on the parser to be robust or just pass the whole text minus command to parent?
            // Actually, the requirements say: "/schedule 5pm Hello" -> Message is "Hello"
            // My parser is simple.
            // Let's improve extraction:
            // The parser `parseNaturalLanguageTime` takes "5pm Hello"? 
            // Currently my parser might get confused by extra text.
            // Let's refine the usage here.

            // Re-parsing strategy for message extraction:
            // We need to split time and message.
            // "5pm Hello" -> Time: 5pm, Msg: Hello
            // "tomorrow 9am Meeting" -> Time: tomorrow 9am, Msg: Meeting

            // Since the parser is basic, let's assume the time is at the start.
            // But `parseNaturalLanguageTime` creates a Date. It doesn't return "rest of string".
            // That is a limitation.

            // For now, let's just pass the raw input text to `onRequestSchedule` and let parent or a helper handle extraction?
            // Or better: Let's assume the user MUST confirm the message in the modal, 
            // so we can pass the whole text to the modal and let the user edit it? 
            // OR simple regex: split by first space after time?
            // It's hard to know where time ends. "tomorrow 9am".

            // Quick fix: The `scheduledTime` state is already set by `handleTextChange` calling parser.
            // Does the parser handle trailing text?
            // "5pm Hello" -> `parseNaturalLanguageTime` might return Valid Date if it matches "5pm".
            // My parser uses regex `^...$`. It expects EXACT match for "in X mins".
            // But for "today..." it does `startsWith`.
            // For time `match`, it checks `^...$`.
            // So "5pm Hello" will FAIL my parser.

            // PROPOSED FIX: Update `handleTextChange` to try to identify the time part.
            // OR update parser to be more loose.
            // Let's update `onRequestSchedule` blindly with current parsed time.
            // BUT wait, if parser failed on "5pm Hello", `scheduledTime` is NULL.
            // So the user can't send.

            // I need to update `utils/timeParser.ts` to support extracting time from start of string.
            // This is safer.
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

    return (
        <View style={styles.inputArea}>
            {/* Suggested Commands */}
            <SlashCommandSuggestions
                visible={showSlashSuggestions}
                onSelect={handleSelectCommand}
            />

            {/* Inline Guidance */}
            <InlineScheduleGuidance
                visible={showScheduleGuidance}
                isValid={!!scheduledTime && !scheduleError}
                parseError={scheduleError || undefined}
                parsedTime={scheduledTime}
            />

            <GlassCard
                style={styles.inputWrapper}
                contentContainerStyle={styles.inputContent}
                intensity={30}
            >
                {isRecording ? (
                    <View style={styles.recordingContainer}>
                        <TouchableOpacity onPress={cancelRecording} style={styles.deleteButton}>
                            <Trash2 size={24} color={Colors.textSecondary} />
                        </TouchableOpacity>

                        <View style={styles.recordingInfo}>
                            <View style={[styles.recordingDot, isRecordingLocked && { backgroundColor: Colors.primary }]} />
                            <ThemedText style={styles.timerText}>{formatDuration(recordingDuration)}</ThemedText>
                            {/* Simple Visual Waveform */}
                            <View style={styles.waveformContainer}>
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Animated.View
                                        key={i}
                                        style={[
                                            styles.waveformBar,
                                            {
                                                height: 10 + Math.random() * 10,
                                                opacity: waveformAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [0.3, 1]
                                                }),
                                                backgroundColor: isRecordingLocked ? Colors.primary : Colors.textSecondary
                                            }
                                        ]}
                                    />
                                ))}
                            </View>
                        </View>

                        {!isRecordingLocked && (
                            <Animated.View style={[styles.slideCancelContainer, { opacity: cancelOpacity }]}>
                                <ChevronLeft size={16} color={Colors.textSecondary} />
                                <ThemedText style={styles.slideCancelText}>Slide to cancel</ThemedText>
                            </Animated.View>
                        )}

                        <Animated.View
                            style={{
                                transform: [
                                    { translateX: micTranslateX },
                                    { scale: micScale }
                                ]
                            }}
                            {...panResponder.panHandlers}
                        >
                            <View style={[styles.micButton, { backgroundColor: isRecordingLocked ? Colors.primary : Colors.error }]}>
                                {isRecordingLocked ? (
                                    <Send size={24} color="#FFF" />
                                ) : (
                                    <Mic size={24} color="#FFF" />
                                )}
                            </View>
                        </Animated.View>
                    </View>
                ) : (
                    <>
                        {editingMessage ? (
                            <TouchableOpacity style={styles.iconButton} onPress={handleCancelEdit}>
                                <X size={22} color={Colors.error || '#FF3B30'} />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.iconButton} onPress={handleEmojiToggle} disabled={isUploading}>
                                <Smile size={24} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        )}

                        <TextInput
                            ref={inputRef}
                            style={styles.input}
                            placeholder={editingMessage ? "Edit message..." : "Type something..."}
                            placeholderTextColor={Colors.textSecondary}
                            value={inputText}
                            onChangeText={handleTextChange}
                            multiline
                            maxLength={5000}
                            onFocus={() => {
                                setIsPanelOpen(false);
                                setIsAttachmentPanelOpen(false);
                            }}
                        />

                        {!editingMessage && (
                            <TouchableOpacity
                                style={styles.iconButton}
                                onPress={handleAttachmentToggle}
                                disabled={isUploading}
                            >
                                <Paperclip size={22} color={isAttachmentPanelOpen ? Colors.primary : Colors.textSecondary} />
                            </TouchableOpacity>
                        )}

                        <View style={styles.verticalDivider} />

                        {isInputAreaActive ? (
                            <TouchableOpacity
                                style={styles.iconButton}
                                onPress={() => {
                                    if (editingMessage) {
                                        handleSaveEdit();
                                    } else if (scheduledTime && !scheduleError) {
                                        // Extract message content safely
                                        const scheduleCommandRegex = /^\/schedule\s+/i;
                                        const textWithoutCommand = inputText.replace(scheduleCommandRegex, '').trim();

                                        // Re-parse to get the exact used time string
                                        const { usedText } = parseNaturalLanguageTime(textWithoutCommand);

                                        let finalMessage = textWithoutCommand;
                                        if (usedText) {
                                            const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                            const usedTextRegex = new RegExp(`^${escapeRegExp(usedText)}\\s*`, 'i');
                                            finalMessage = textWithoutCommand.replace(usedTextRegex, '').trim();
                                        }

                                        onRequestSchedule(scheduledTime, finalMessage);
                                    } else {
                                        // Check for /otv command
                                        let textToSend = inputText;
                                        let isOneTimeMsg = false;

                                        if (textToSend.trim().toLowerCase().startsWith('/otv ')) {
                                            isOneTimeMsg = true;
                                            textToSend = textToSend.replace(/^\/otv\s+/i, '').trim();
                                        }

                                        handleSend(textToSend, null, false, isOneTimeMsg);
                                    }
                                }}
                                disabled={!inputText.trim() || isSending || isUploading || (showScheduleGuidance && !scheduledTime)}
                            >
                                {editingMessage ? (
                                    <View style={styles.sendIconContainer}>
                                        <Check
                                            size={22}
                                            color={(inputText.trim()) ? Colors.primary : Colors.textSecondary}
                                        />
                                    </View>
                                ) : (
                                    <View style={styles.sendIconContainer}>
                                        <Send
                                            size={22}
                                            color={(inputText.trim() && !isSending && !isUploading) ? (scheduledTime ? Colors.primary : Colors.primary) : Colors.textSecondary}
                                            fill={(inputText.trim() && !isSending && !isUploading) ? (scheduledTime ? 'transparent' : Colors.primary) : 'transparent'}
                                        />
                                        {scheduledTime && (
                                            <View style={{ position: 'absolute', bottom: -2, right: -2 }}>
                                                <Clock size={10} color={Colors.primary} />
                                            </View>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                        ) : (
                            <View
                                style={styles.micButtonWrapper}
                                {...panResponder.panHandlers}
                            >
                                <View style={styles.micIconContainer}>
                                    <Mic
                                        size={22}
                                        color={Colors.textSecondary}
                                    />
                                </View>
                            </View>
                        )}
                    </>
                )}
            </GlassCard>
        </View>
    );
};

const styles = StyleSheet.create({
    inputArea: {
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 6,
    },
    inputWrapper: {
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    inputContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 6,
        minHeight: 50,
    },
    recordingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flex: 1,
        paddingHorizontal: 10,
    },
    deleteButton: {
        padding: 8,
        marginRight: 8,
    },
    recordingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.error,
        marginRight: 4,
    },
    timerText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
        minWidth: 50,
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        height: 24,
        marginLeft: 8,
    },
    waveformBar: {
        width: 3,
        backgroundColor: Colors.textSecondary,
        borderRadius: 2,
    },
    slideCancelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
    },
    slideCancelText: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginLeft: 4,
    },
    micButtonWrapper: {
        padding: 4,
    },
    micButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    iconButton: {
        padding: 6,
    },
    input: {
        flex: 1,
        color: Colors.text,
        fontSize: 16,
        maxHeight: 100,
        paddingVertical: 0,
        paddingHorizontal: 8,
        textAlignVertical: 'center',
    },
    verticalDivider: {
        width: 1,
        height: 24,
        backgroundColor: Colors.glassBorder,
        marginHorizontal: 4,
    },
    sendIconContainer: {
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center'
    },
    micIconContainer: {
        width: 30,
        height: 30,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
});

