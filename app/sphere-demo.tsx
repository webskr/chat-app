import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SphereImageGrid, ImageData } from '../components/ui/SphereImageGrid';
import { Colors } from '../constants/Colors';
import { ThemedText } from '../components/ThemedText';

// ==========================================
// CONFIGURATION
// ==========================================

const BASE_IMAGES: Omit<ImageData, 'id'>[] = [
    {
        src: "https://images.unsplash.com/photo-1758178309498-036c3d7d73b3?auto=format&fit=crop&q=80&w=987",
        alt: "Image 1",
        title: "Mountain Landscape",
        description: "A beautiful landscape captured at golden hour with mountains in the background."
    },
    {
        src: "https://images.unsplash.com/photo-1757647016230-d6b42abc6cc9?auto=format&fit=crop&q=80&w=2072",
        alt: "Image 2",
        title: "Portrait Photography",
        description: "Stunning portrait photography showcasing natural lighting and composition."
    },
    {
        src: "https://images.unsplash.com/photo-1757906447358-f2b2cb23d5d8?auto=format&fit=crop&q=80&w=987",
        alt: "Image 3",
        title: "Urban Architecture",
        description: "Modern architectural design featuring clean lines and geometric patterns."
    },
    {
        src: "https://images.unsplash.com/photo-1742201877377-03d18a323c18?auto=format&fit=crop&q=80&w=1064",
        alt: "Image 4",
        title: "Nature Scene",
        description: "Peaceful nature scene with vibrant colors and natural beauty."
    },
    {
        src: "https://images.unsplash.com/photo-1757081791153-3f48cd8c67ac?auto=format&fit=crop&q=80&w=987",
        alt: "Image 5",
        title: "Abstract Art",
        description: "Creative abstract composition with bold colors and unique patterns."
    },
    {
        src: "https://images.unsplash.com/photo-1757626961383-be254afee9a0?auto=format&fit=crop&q=80&w=987",
        alt: "Image 6",
        title: "Mountain Landscape",
        description: "A beautiful landscape captured at golden hour with mountains in the background."
    },
    {
        src: "https://images.unsplash.com/photo-1756748371390-099e4e6683ae?auto=format&fit=crop&q=80&w=987",
        alt: "Image 7",
        title: "Portrait Photography",
        description: "Stunning portrait photography showcasing natural lighting and composition."
    },
    {
        src: "https://images.unsplash.com/photo-1755884405235-5c0213aa3374?auto=format&fit=crop&q=80&w=987",
        alt: "Image 8",
        title: "Urban Architecture",
        description: "Modern architectural design featuring clean lines and geometric patterns."
    },
    {
        src: "https://images.unsplash.com/photo-1757495404191-e94ed7e70046?auto=format&fit=crop&q=80&w=987",
        alt: "Image 9",
        title: "Nature Scene",
        description: "Peaceful nature scene with vibrant colors and natural beauty."
    },
    {
        src: "https://images.unsplash.com/photo-1756197256528-f9e6fcb82b04?auto=format&fit=crop&q=80&w=1064",
        alt: "Image 10",
        title: "Abstract Art",
        description: "Creative abstract composition with bold colors and unique patterns."
    },
    {
        src: "https://images.unsplash.com/photo-1534083220759-4c3c00112ea0?auto=format&fit=crop&q=80&w=987",
        alt: "Image 11",
        title: "Abstract Art",
        description: "Creative abstract composition with bold colors and unique patterns."
    },
    {
        src: "https://images.unsplash.com/photo-1755278338891-e8d8481ff087?auto=format&fit=crop&q=80&w=1674",
        alt: "Image 12",
        title: "Abstract Art",
        description: "Creative abstract composition with bold colors and unique patterns."
    }
];

// Generate more images by repeating the base set to fill the sphere
const IMAGES: ImageData[] = [];
for (let i = 0; i < 60; i++) {
    const baseIndex = i % BASE_IMAGES.length;
    const baseImage = BASE_IMAGES[baseIndex];
    IMAGES.push({
        id: `img-${i + 1}`,
        ...baseImage,
        alt: `${baseImage.alt} (${Math.floor(i / BASE_IMAGES.length) + 1})`
    });
}

function SphereDemoScreen() {
    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <ThemedText type="title">3D Sphere Gallery</ThemedText>
                <ThemedText type="default" style={styles.subtitle}>Drag to rotate • Tap to view</ThemedText>
            </View>

            <View style={styles.content}>
                <SphereImageGrid
                    images={IMAGES}
                    containerSize={350}
                    sphereRadius={180}
                    baseImageScale={0.12}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        padding: 20,
        alignItems: 'center',
    },
    subtitle: {
        color: Colors.textSecondary,
        marginTop: 5,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 50, // Center it visually a bit higher than dead center usually looks better
    }
});

export default SphereDemoScreen;
