import * as SecureStore from 'expo-secure-store';

export async function saveKey(name: string, value: Uint8Array) {
    await SecureStore.setItemAsync(name, Buffer.from(value).toString("base64"));
}

export async function loadKey(name: string) {
    const v = await SecureStore.getItemAsync(name);
    return v ? new Uint8Array(Buffer.from(v, "base64")) : null;
}
