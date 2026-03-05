import * as Network from 'expo-network';
import { AppState } from 'react-native';

export class NetworkService {
    private static isConnected: boolean = true;
    private static listeners: ((connected: boolean) => void)[] = [];

    static async init() {
        // Initial check
        const state = await Network.getNetworkStateAsync();
        this.isConnected = !!state.isConnected;

        // Note: expo-network doesn't have a direct listener in older versions, 
        // but it's often paired with NetInfo. If we only have expo-network, 
        // we can poll or check on AppState change.

        AppState.addEventListener('change', async (nextAppState) => {
            if (nextAppState === 'active') {
                await this.checkConnection();
            }
        });

        // Periodic check every 10 seconds as a fallback
        setInterval(() => this.checkConnection(), 10000);
    }

    static async checkConnection(): Promise<boolean> {
        const state = await Network.getNetworkStateAsync();
        const wasConnected = this.isConnected;
        this.isConnected = !!state.isConnected;

        if (wasConnected !== this.isConnected) {
            this.notifyListeners();
        }
        return this.isConnected;
    }

    static subscribe(callback: (connected: boolean) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private static notifyListeners() {
        this.listeners.forEach(callback => callback(this.isConnected));
    }

    static getIsConnected(): boolean {
        return this.isConnected;
    }
}
