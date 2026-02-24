import * as Random from 'expo-random';

export async function secureRandomBytes(length: number) {
    return await Random.getRandomBytesAsync(length);
}
