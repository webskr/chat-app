import React from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { FileText, Download, FileJson, FileType2, FileCode, FileSpreadsheet, File } from 'lucide-react-native';
import { ThemedText } from './ThemedText';
import { Colors } from '../constants/Colors';
import { Config } from '../constants/Config';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface DocumentMessageBubbleProps {
    fileUrl: string;
    fileName: string | null;
    fileSize: number;
    mimeType: string | null;
    isMe: boolean;
    onLongPress?: () => void;
}

export const DocumentMessageBubble: React.FC<DocumentMessageBubbleProps> = ({ fileUrl, fileName, fileSize, mimeType, isMe, onLongPress }) => {

    const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${Config.API_URL}/${fileUrl.replace(/^\//, '')}`;
    const displaySize = fileSize ? (fileSize / (1024 * 1024)).toFixed(2) + ' MB' : '';

    const getIcon = () => {
        if (mimeType?.includes('pdf')) return <FileText size={24} color={Colors.primary} />;
        if (mimeType?.includes('sheet') || mimeType?.includes('excel') || mimeType?.includes('csv')) return <FileSpreadsheet size={24} color="#107C41" />; // Excel green
        if (mimeType?.includes('word') || mimeType?.includes('document')) return <FileText size={24} color="#2B579A" />; // Word blue
        if (mimeType?.includes('zip') || mimeType?.includes('compressed')) return <FileCode size={24} color="#FDB813" />; // Zip yellow-ish
        return <File size={24} color={Colors.text} />;
    };

    const saveAndroidFile = async (fileUri: string, fileName: string, mimeType: string) => {
        try {
            const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (permissions.granted) {
                const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
                const newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, mimeType || 'application/octet-stream');
                await FileSystem.writeAsStringAsync(newFileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
                alert('File saved successfully!');
            } else {
                // permission denied
            }
        } catch (e) {
            console.error(e);
            alert('Failed to save file.');
        }
    };

    const handleDownload = async () => {
        try {
            if (Platform.OS === 'web') {
                Linking.openURL(fullUrl);
                return;
            }

            if (Platform.OS === 'android') {
                // Download to cache first
                const fileUri = FileSystem.cacheDirectory + (fileName || 'document.pdf');
                const downloadResumable = FileSystem.createDownloadResumable(fullUrl, fileUri);
                const result = await downloadResumable.downloadAsync();

                if (result && result.uri) {
                    await saveAndroidFile(result.uri, fileName || 'document', mimeType || 'application/pdf');
                }
                return;
            }

            // iOS: Share
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fullUrl, {
                    dialogTitle: fileName || 'Download Document',
                    mimeType: mimeType || undefined,
                    UTI: undefined
                });
            } else {
                alert('Sharing is not available');
            }
        } catch (e) {
            console.error('DOWNLOAD ERROR:', e);
            alert('Failed to download file.');
        }
    };

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={handleDownload}
            onLongPress={onLongPress}
            delayLongPress={300}
            activeOpacity={0.8}
        >
            <View style={styles.iconContainer}>
                {getIcon()}
            </View>
            <View style={styles.infoContainer}>
                <ThemedText style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                    {fileName || 'Unknown Document'}
                </ThemedText>
                <ThemedText style={styles.fileSize}>
                    {displaySize} • {(mimeType ? mimeType.split('/')[1] : 'FILE')?.toUpperCase() || 'FILE'}
                </ThemedText>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 12,
        width: 240,
        marginBottom: 2
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    infoContainer: {
        flex: 1,
    },
    fileName: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 2,
    },
    fileSize: {
        fontSize: 10,
        color: Colors.textSecondary,
    },
    downloadIcon: {
        marginLeft: 8,
    }
});
