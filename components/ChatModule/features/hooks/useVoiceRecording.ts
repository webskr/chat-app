import { useState, useRef, useEffect } from 'react';
import { Alert, Platform, Vibration } from 'react-native';
import { Audio } from 'expo-av';

export const useVoiceRecording = (onUpload: (uri: string, duration: number) => Promise<void>) => {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'stopped'>('idle');
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [isRecordingPermissionGranted, setIsRecordingPermissionGranted] = useState(false);
    const recordingInterval = useRef<NodeJS.Timeout | null>(null);

    // Refs for synchronous tracking and locking
    const recordingRef = useRef<Audio.Recording | null>(null);
    const isStartingRef = useRef(false);
    const shouldStopImmediately = useRef(false);
    const shouldCancelImmediately = useRef(false);

    useEffect(() => {
        (async () => {
            const { status } = await Audio.requestPermissionsAsync();
            setIsRecordingPermissionGranted(status === 'granted');
        })();

        return () => {
            if (recordingInterval.current) {
                clearInterval(recordingInterval.current);
            }
            // Cleanup on unmount
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync();
            }
        };
    }, []);

    const startRecording = async () => {
        if (isStartingRef.current) return;
        isStartingRef.current = true;
        shouldStopImmediately.current = false;
        shouldCancelImmediately.current = false;

        try {
            // Cleanup any existing recording first
            if (recordingRef.current) {
                try {
                    await recordingRef.current.stopAndUnloadAsync();
                } catch (e) {
                    console.log('Error cleaning up previous recording:', e);
                }
                recordingRef.current = null;
                setRecording(null);
            }

            if (!isRecordingPermissionGranted) {
                const { status } = await Audio.requestPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Please grant microphone permission to record voice messages.');
                    return;
                }
                setIsRecordingPermissionGranted(true);
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            // Check if we should abort immediately (race condition handling)
            if (shouldCancelImmediately.current) {
                // Must unset isStartingRef so cancelRecording can proceed if called directly,
                // or we call it manually here. simpler to call manual cleanup.
                await newRecording.stopAndUnloadAsync();
                setRecordingStatus('idle');
                isStartingRef.current = false;
                return;
            }

            recordingRef.current = newRecording;
            setRecording(newRecording);
            setRecordingStatus('recording');
            setRecordingDuration(0);

            // Handle immediate stop request
            if (shouldStopImmediately.current) {
                isStartingRef.current = false; // ALLOW stopRecording to proceed
                await stopRecording();
                return;
            }

            // Haptic feedback
            if (Platform.OS !== 'web') Vibration.vibrate(50);

            const startTime = Date.now();
            recordingInterval.current = setInterval(() => {
                const durationDetail = Math.floor((Date.now() - startTime) / 1000);
                setRecordingDuration(durationDetail);
            }, 1000);

            console.log('Recording started');
        } catch (err) {
            console.error('Failed to start recording', err);
            setRecordingStatus('idle');
            isStartingRef.current = false;
        } finally {
            // Only reset if we didn't already handle an immediate stop/cancel
            if (!shouldStopImmediately.current && !shouldCancelImmediately.current) {
                isStartingRef.current = false;
            }
        }
    };

    const stopRecording = async () => {
        console.log('Stopping recording..');

        // Handle race condition: Stop requested while starting
        if (isStartingRef.current) {
            shouldStopImmediately.current = true;
            return;
        }

        const currentRecording = recordingRef.current;
        if (!currentRecording) return;

        // Immediately clear the ref to prevent double calls/uploads
        recordingRef.current = null;

        setRecordingStatus('stopped');
        if (recordingInterval.current) {
            clearInterval(recordingInterval.current);
            recordingInterval.current = null;
        }

        try {
            await currentRecording.stopAndUnloadAsync();
            const uri = currentRecording.getURI();
            const status = await currentRecording.getStatusAsync();
            const duration = status.durationMillis ? status.durationMillis / 1000 : recordingDuration;

            console.log('Recording stopped and stored at', uri, 'duration:', duration);

            // Validate duration (min 0.5s to discard accidental taps not handled by UI)
            // If UI handles Tap-to-Lock correctly, this discard should only fire for extremely weird cases.
            if (duration < 0.5) {
                console.log('Recording too short, discarding.');
                recordingRef.current = null;
                setRecording(null);
                setRecordingStatus('idle');
                setRecordingDuration(0);
                return;
            }

            // Upload and send
            if (uri) {
                // Use Math.max(1, ...) to ensure at least 1 second is logged if it's a valid file
                await onUpload(uri, Math.max(1, Math.ceil(duration)));
            }

        } catch (error: any) {
            const errorMsg = error?.message || error?.toString() || '';
            if (errorMsg.includes('no valid audio data')) {
                console.log('Recording too short (no audio data), discarding.');
            } else {
                console.error('Error stopping recording', error);
            }
        }

        // Reset
        recordingRef.current = null;
        setRecording(null);
        setRecordingStatus('idle');
        setRecordingDuration(0);
        try {
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        } catch (e) { }
    };

    const cancelRecording = async () => {
        // Handle race condition: Cancel requested while starting
        if (isStartingRef.current) {
            shouldCancelImmediately.current = true;
            return;
        }

        const currentRecording = recordingRef.current;
        if (!currentRecording) return;

        setRecordingStatus('idle');
        if (recordingInterval.current) {
            clearInterval(recordingInterval.current);
            recordingInterval.current = null;
        }

        try {
            await currentRecording.stopAndUnloadAsync();
        } catch (error) {
            console.error('Error cancelling recording', error);
        }

        recordingRef.current = null;
        setRecording(null);
        setRecordingDuration(0);
        try {
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        } catch (e) { }
    };

    return {
        recordingStatus,
        recordingDuration,
        startRecording,
        stopRecording,
        cancelRecording,
        isRecordingPermissionGranted
    };
};
