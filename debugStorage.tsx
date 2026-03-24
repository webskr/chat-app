import * as FileSystem from 'expo-file-system';
import { getPublicMediaDirectory } from './modules/vegram-media';

export async function debugListMedia() {
    const publicDir = getPublicMediaDirectory();
    const internalDir = `${FileSystem.documentDirectory}vegram/`;
    
    console.log('--- STORAGE DEBUG ---');
    console.log('Internal Dir:', internalDir);
    console.log('Public Dir:', publicDir);
    
    const dirs = [
        internalDir,
        internalDir + 'images/',
        internalDir + 'videos/',
        internalDir + 'documents/',
        publicDir,
        publicDir + 'images/',
        publicDir + 'videos/',
        publicDir + 'documents/',
    ];
    
    for (const dir of dirs) {
        if (!dir) continue;
        try {
            const info = await FileSystem.getInfoAsync(dir);
            if (info.exists) {
                const files = await FileSystem.readDirectoryAsync(dir);
                console.log(`Contents of ${dir} (${files.length} files):`);
                files.slice(0, 10).forEach(f => {
                    // Check size too
                    FileSystem.getInfoAsync(dir + f, { size: true }).then(i => {
                        console.log(`  - ${f} (${(i as any).size || 0} bytes)`);
                    });
                });
            } else {
                console.log(`Dir does not exist: ${dir}`);
            }
        } catch (e) {
            console.log(`Error reading ${dir}:`, e);
        }
    }
}
