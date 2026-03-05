import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as FileSystem from 'expo-file-system';

export class GoogleDriveService {
    private static DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
    private static UPLOAD_API_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    static async uploadFile(fileUri: string, fileName: string): Promise<string> {
        const { accessToken } = await GoogleSignin.getTokens();

        const fileContent = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
        const boundary = 'foo_bar_baz';

        const metadata = {
            name: fileName,
            mimeType: 'application/zip',
            parents: ['appDataFolder'] // Save in app-specific hidden folder
        };

        const body = `--${boundary}\r\n` +
            `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
            `${JSON.stringify(metadata)}\r\n` +
            `--${boundary}\r\n` +
            `Content-Type: application/zip\r\n` +
            `Content-Transfer-Encoding: base64\r\n\r\n` +
            `${fileContent}\r\n` +
            `--${boundary}--`;

        const response = await fetch(this.UPLOAD_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: body
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Drive upload failed');

        return data.id;
    }

    static async listBackups(): Promise<any[]> {
        const { accessToken } = await GoogleSignin.getTokens();
        const response = await fetch(`${this.DRIVE_API_URL}?spaces=appDataFolder&fields=files(id,name,createdTime)`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Drive list failed');

        return data.files || [];
    }

    static async downloadFile(fileId: string, destUri: string): Promise<void> {
        const { accessToken } = await GoogleSignin.getTokens();
        const response = await fetch(`${this.DRIVE_API_URL}/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!response.ok) throw new Error('Drive download failed');

        // Fetch as blob and save
        const blob = await response.blob();
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];
                await FileSystem.writeAsStringAsync(destUri, base64, { encoding: FileSystem.EncodingType.Base64 });
                resolve();
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}
