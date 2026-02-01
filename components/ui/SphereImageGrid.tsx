import React, { useState, useEffect, useCallback } from 'react';
import { View, Image, StyleSheet, Dimensions, TouchableOpacity, Modal, Text } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    withDecay,
    cancelAnimation,
    withTiming
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface Position3D {
    x: number;
    y: number;
    z: number;
}

export interface SphericalPosition {
    theta: number;  // Azimuth angle in degrees
    phi: number;    // Polar angle in degrees
    radius: number; // Distance from center
}

export interface WorldPosition extends Position3D {
    scale: number;
    zIndex: number;
    isVisible: boolean;
    fadeOpacity: number;
    originalIndex: number;
}

export interface ImageData {
    id: string;
    src: string;
    alt: string;
    title?: string;
    description?: string;
}

export interface SphereImageGridProps {
    images?: ImageData[];
    containerSize?: number;
    sphereRadius?: number;
    dragSensitivity?: number;
    momentumDecay?: number;
    maxRotationSpeed?: number;
    baseImageScale?: number;
    autoRotate?: boolean;
    autoRotateSpeed?: number;
}

// ==========================================
// CONSTANTS & CONFIGURATION
// ==========================================

const degreesToRadians = (degrees: number): number => {
    'worklet';
    return degrees * (Math.PI / 180);
};

const radiansToDegrees = (radians: number): number => {
    'worklet';
    return radians * (180 / Math.PI);
};

const normalizeAngle = (angle: number): number => {
    'worklet';
    let normalized = angle;
    while (normalized > 180) normalized -= 360;
    while (normalized < -180) normalized += 360;
    return normalized;
};

const DefaultProps = {
    containerSize: 400,
    sphereRadius: 200,
    dragSensitivity: 0.5,
    momentumDecay: 0.95,
    maxRotationSpeed: 5,
    baseImageScale: 0.12,
    autoRotate: true,
    autoRotateSpeed: 0.3,
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export function SphereImageGrid({
    images = [],
    containerSize = DefaultProps.containerSize,
    sphereRadius = DefaultProps.sphereRadius,
    dragSensitivity = DefaultProps.dragSensitivity,
    momentumDecay = DefaultProps.momentumDecay,
    maxRotationSpeed = DefaultProps.maxRotationSpeed,
    baseImageScale = DefaultProps.baseImageScale,
    autoRotate = DefaultProps.autoRotate,
    autoRotateSpeed = DefaultProps.autoRotateSpeed,
}: SphereImageGridProps) {

    // ==========================================
    // STATE & REFS
    // ==========================================
    const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
    const [imagePositions, setImagePositions] = useState<SphericalPosition[]>([]);

    // Shared values for rotation
    const rotationX = useSharedValue(15);
    const rotationY = useSharedValue(15);

    // Shared values for momentum/velocity tracking to feed into auto-rotation or decay
    // Note: For simplicity in this port, we'll drive the "auto-rotate" using a React effect interval 
    // or a recursive Reanimated call if we want 60fps, but let's stick to a simpler approach first 
    // where we just update rotationY frame-by-frame if autoRotate is on and not dragging.

    const isDragging = useSharedValue(false);

    // ==========================================
    // COMPUTED VALUES
    // ==========================================

    const actualSphereRadius = sphereRadius || containerSize * 0.5;
    const baseImageSize = containerSize * baseImageScale;

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================

    const generateSpherePositions = useCallback((): SphericalPosition[] => {
        const positions: SphericalPosition[] = [];
        const imageCount = images.length;

        if (imageCount === 0) return [];

        // Use Fibonacci sphere distribution for even coverage
        const goldenRatio = (1 + Math.sqrt(5)) / 2;
        const angleIncrement = 2 * Math.PI / goldenRatio;

        for (let i = 0; i < imageCount; i++) {
            const t = i / imageCount;
            const inclination = Math.acos(1 - 2 * t);
            const azimuth = angleIncrement * i;

            let phi = inclination * (180 / Math.PI);
            let theta = (azimuth * (180 / Math.PI)) % 360;

            // Better pole coverage
            const poleBonus = Math.pow(Math.abs(phi - 90) / 90, 0.6) * 35;
            if (phi < 90) {
                phi = Math.max(5, phi - poleBonus);
            } else {
                phi = Math.min(175, phi + poleBonus);
            }

            phi = 15 + (phi / 180) * 150;

            const randomOffset = (Math.random() - 0.5) * 20;
            theta = (theta + randomOffset) % 360;
            phi = Math.max(0, Math.min(180, phi + (Math.random() - 0.5) * 10));

            positions.push({
                theta: theta,
                phi: phi,
                radius: actualSphereRadius
            });
        }

        return positions;
    }, [images.length, actualSphereRadius]);

    // ==========================================
    // GESTURES
    // ==========================================

    const panGesture = Gesture.Pan()
        .onBegin(() => {
            isDragging.value = true;
            cancelAnimation(rotationX);
            cancelAnimation(rotationY);
        })
        .onUpdate((e) => {
            // Update rotation based on gesture delta
            // Note: dividing by factor to tune sensitivity
            rotationY.value += (e.translationX / 10) * dragSensitivity;
            rotationX.value -= (e.translationY / 10) * dragSensitivity;

            // Reset translation effectively by not storing it, we just add deltas? 
            // Actually standard pan gesture accumulates translation. 
            // Better pattern: store offset.
            // For simplicity, let's just add the *change* since last frame? 
            // No, Reanimated Pan gives accumulated translation.
            // We'll use a slightly different pattern below for better control or just commit every frame?
            // Let's stick to: .onChange() is safer for deltas.
        })
        .onChange((e) => {
            rotationY.value += e.changeX * dragSensitivity;
            rotationX.value -= e.changeY * dragSensitivity;
        })
        .onFinalize((e) => {
            isDragging.value = false;

            // Apply momentum (decay)
            // velocityX is in px/sec. We map it to rotation speed.
            rotationX.value = withDecay({
                velocity: -e.velocityY * 0.01 * dragSensitivity, // mild scaling
                deceleration: momentumDecay
            });

            rotationY.value = withDecay({
                velocity: e.velocityX * 0.01 * dragSensitivity,
                deceleration: momentumDecay
            });
        });

    // ==========================================
    // AUTO ROTATE
    // ==========================================
    // We use a useFrameCallback or just a simple interval wrapper logic 
    // But Reanimated doesn't have a simple "always run loop" hook that's purely declarative without shared value drivers.
    // We can simulate auto-rotate by constantly updating a value if not dragging.

    useEffect(() => {
        setImagePositions(generateSpherePositions());
    }, [generateSpherePositions]);

    // Simulating auto-rotate loop with a requestAnimationFrame loop on JS side that updates SharedValue?
    // No, that crosses bridge too much. 
    // Let's use a standard React Native effect loop for the "base" rotation if we aren't dragging.
    useEffect(() => {
        if (!autoRotate) return;

        let AnimationFrameId: number;

        const loop = () => {
            if (!isDragging.value) {
                rotationY.value += autoRotateSpeed;
            }
            AnimationFrameId = requestAnimationFrame(loop);
        };
        loop();

        return () => cancelAnimationFrame(AnimationFrameId);
    }, [autoRotate, autoRotateSpeed]);


    // ==========================================
    // RENDER HELPERS
    // ==========================================

    // Since we cannot run complex array maps easily on the UI thread for *mounting* components,
    // we will map the static items, and each item will have its own useAnimatedStyle 
    // that computes its specific position based on the shared rotationX/Y values.

    const SphereItem = ({ pos, index, image }: { pos: SphericalPosition, index: number, image: ImageData }) => {

        const animatedStyle = useAnimatedStyle(() => {
            const thetaRad = degreesToRadians(pos.theta);
            const phiRad = degreesToRadians(pos.phi);
            const rotXRad = degreesToRadians(rotationX.value);
            const rotYRad = degreesToRadians(rotationY.value);

            // 1. Initial position
            let x = pos.radius * Math.sin(phiRad) * Math.cos(thetaRad);
            let y = pos.radius * Math.cos(phiRad);
            let z = pos.radius * Math.sin(phiRad) * Math.sin(thetaRad);

            // 2. Rotate Y (Horizontal)
            const x1 = x * Math.cos(rotYRad) + z * Math.sin(rotYRad);
            const z1 = -x * Math.sin(rotYRad) + z * Math.cos(rotYRad);
            x = x1;
            z = z1;

            // 3. Rotate X (Vertical)
            const y2 = y * Math.cos(rotXRad) - z * Math.sin(rotXRad);
            const z2 = y * Math.sin(rotXRad) + z * Math.cos(rotXRad);
            y = y2;
            z = z2;

            // 4. Visibility & Scale
            const fadeZoneStart = -10;
            const fadeZoneEnd = -30;

            let fadeOpacity = 1;
            if (z <= fadeZoneStart) {
                fadeOpacity = Math.max(0, (z - fadeZoneEnd) / (fadeZoneStart - fadeZoneEnd));
            }


            const scaleBase = baseImageScale * 4; // Arbitrary scaler to match container relative size roughly
            const depthScale = (z + actualSphereRadius) / (2 * actualSphereRadius);
            const scale = scaleBase * Math.max(0.5, 0.8 + depthScale * 0.3) * (containerSize / 100); // Rough approximation

            return {
                transform: [
                    { translateX: x },
                    { translateY: y },
                    { scale: scale }
                ] as any,
                zIndex: Math.round(1000 + z),
                opacity: fadeOpacity
            };
        });

        return (
            <Animated.View style={[styles.item, animatedStyle]}>
                <TouchableOpacity onPress={() => runOnJS(setSelectedImage)(image)} activeOpacity={0.9}>
                    <Image
                        source={{ uri: image.src }}
                        style={styles.image}
                        resizeMode="cover"
                    />
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <View style={styles.container}>
            <GestureDetector gesture={panGesture}>
                <View style={[styles.sphereContainer, { width: containerSize, height: containerSize }]}>
                    {imagePositions.map((pos, index) => (
                        <SphereItem
                            key={images[index].id}
                            pos={pos}
                            index={index}
                            image={images[index]}
                        />
                    ))}
                </View>
            </GestureDetector>

            {/* Selected Image Modal */}
            <Modal
                visible={!!selectedImage}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedImage(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setSelectedImage(null)}
                        >
                            <X color="#FFF" size={24} />
                        </TouchableOpacity>

                        {selectedImage && (
                            <>
                                <Image
                                    source={{ uri: selectedImage.src }}
                                    style={styles.modalImage}
                                    resizeMode="cover"
                                />
                                <View style={styles.modalTextContainer}>
                                    <Text style={styles.modalTitle}>{selectedImage.title || 'Image'}</Text>
                                    {selectedImage.description && (
                                        <Text style={styles.modalDesc}>{selectedImage.description}</Text>
                                    )}
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    sphereContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        // Creating a 3D feel? 
    },
    item: {
        position: 'absolute',
        width: 100, // Base size, scaled by transform
        height: 100,
        borderRadius: 50,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        width: '90%',
        backgroundColor: Colors.surface || '#1E293B',
        borderRadius: 20,
        overflow: 'hidden',
        paddingBottom: 20,
    },
    modalImage: {
        width: '100%',
        height: 300,
    },
    closeButton: {
        position: 'absolute',
        top: 15,
        right: 15,
        zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 8,
        borderRadius: 20,
    },
    modalTextContainer: {
        padding: 20,
    },
    modalTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    modalDesc: {
        color: '#CCC',
        fontSize: 14,
        lineHeight: 20,
    }
});
