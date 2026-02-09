import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { Play, Pause } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { ThemedText } from './ThemedText';
import { Config } from '../constants/Config';

interface VoiceMessageBubbleProps {
    audioUrl: string;
    duration: number; // in seconds
    isMe: boolean;
}

export const VoiceMessageBubble: React.FC<VoiceMessageBubbleProps> = ({ audioUrl, duration, isMe }) => {
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [currentDuration, setCurrentDuration] = useState(duration * 1000); // ms

    // Mock waveform bars
    const barCount = 20;
    const waveformBars = useMemo(() => {
        return Array.from({ length: barCount }).map(() => Math.floor(Math.random() * 20) + 10);
    }, []);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const loadSound = async () => {
        setIsLoading(true);
        try {
            const cleanUrl = audioUrl.startsWith('http') ? audioUrl : `${Config.API_URL}/${audioUrl.replace(/^\//, '')}`;
            console.log('Loading sound:', cleanUrl);

            const { sound: newSound, status } = await Audio.Sound.createAsync(
                { uri: cleanUrl },
                { shouldPlay: true },
                onPlaybackStatusUpdate
            );

            setSound(newSound);
            setIsPlaying(true);
            if (status.isLoaded && status.durationMillis) {
                setCurrentDuration(status.durationMillis);
            }
        } catch (error) {
            console.error('Error loading sound:', error);
            // alert('Could not play audio'); // Optional
        } finally {
            setIsLoading(false);
        }
    };

    const onPlaybackStatusUpdate = (status: any) => {
        if (status.isLoaded) {
            setPosition(status.positionMillis);
            setIsPlaying(status.isPlaying);
            if (status.didJustFinish) {
                setPosition(0);
                setIsPlaying(false);
            }
        }
    };

    const handlePlayPause = async () => {
        if (!sound) {
            await loadSound();
        } else {
            if (isPlaying) {
                await sound.pauseAsync();
            } else {
                if (position >= currentDuration) {
                    await sound.replayAsync();
                } else {
                    await sound.playAsync();
                }
            }
        }
    };

    useEffect(() => {
        return () => {
            sound?.unloadAsync();
        };
    }, [sound]);

    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, []);

    const progress = currentDuration > 0 ? (position / currentDuration) : 0;
    const currentBarIndex = Math.floor(progress * barCount);

    return (
        <View style={styles.container}>
            <View style={styles.mainRow}>
                <TouchableOpacity onPress={handlePlayPause} style={styles.playButton} disabled={isLoading}>
                    {isLoading ? (
                        <ActivityIndicator size="small" color={isMe ? Colors.surface : Colors.text} />
                    ) : isPlaying ? (
                        <Pause size={24} color={isMe ? Colors.surface : Colors.text} fill={isMe ? Colors.surface : Colors.text} />
                    ) : (
                        <Play size={24} color={isMe ? Colors.surface : Colors.text} fill={isMe ? Colors.surface : Colors.text} />
                    )}
                </TouchableOpacity>

                <View style={styles.waveformContainer}>
                    {waveformBars.map((height, index) => {
                        const isPlayed = index <= currentBarIndex;
                        return (
                            <View
                                key={index}
                                style={[
                                    styles.bar,
                                    {
                                        height: height,
                                        backgroundColor: isPlayed
                                            ? (isMe ? Colors.surface : Colors.primary)
                                            : (isMe ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.2)')
                                    }
                                ]}
                            />
                        );
                    })}
                </View>
            </View>

        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        minWidth: 160,
    },
    mainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    playButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        height: 24,
        flex: 1,
        maxWidth: 120, // constrain width
        overflow: 'hidden',
    },
    bar: {
        width: 3,
        borderRadius: 1.5,
    },
    durationText: {
        fontSize: 10,
        textAlign: 'right',
        marginRight: 4,
        marginTop: 0,
    }
});
