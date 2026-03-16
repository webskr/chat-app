export const Config = {
    // -------------------------------------------------------------------------
    // API CONFIGURATION
    // -------------------------------------------------------------------------
    // Set USE_LOCALHOST to:
    //   false -> To use your computer's IP (Recommended for Physical Devices & Emulators)
    //   true  -> To use 'localhost' (Only works for Web or iOS Simulator)
    // -------------------------------------------------------------------------
    USE_LOCALHOST: false,

    // Base URL from environment variable (baked in at build time)
    // Example: http://192.168.1.10/chat-app/backend or https://ngrok-url.app
    BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL,

    // Your local Machine IP (Fallback if no env var)
    IP_ADDRESS: '10.130.145.5',

    get API_URL() {
        if (this.BACKEND_URL) {
            return this.BACKEND_URL.replace(/\/$/, ''); // Remove trailing slash
        }
        if (this.USE_LOCALHOST) {
            return 'http://localhost/chat-app/backend';
        }
        return `http://${this.IP_ADDRESS}/chat-app/backend`;
    },

    get SOCKET_URL() {
        if (this.BACKEND_URL) {
            // If backend is https (ngrok), we assume socket might be at the same domain or specialized
            // Usually for local dev with ngrok, you might need a separate tunnel for port 3000
            // but for simplicity, we provide a fallback logic.
            try {
                const url = new URL(this.BACKEND_URL);
                // If it's a typical local IP or localhost, just change port
                if (url.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
                    return `${url.protocol}//${url.hostname}:3000`;
                }
                // For ngrok, the user might provide the full backend URL, 
                // but the socket might need its own tunnel. 
                // We'll return the base domain as a guess if it's not local.
                return `${url.protocol}//${url.hostname}`;
            } catch (e) {
                return `http://${this.IP_ADDRESS}:3000`;
            }
        }

        if (this.USE_LOCALHOST) {
            return 'http://localhost:3000';
        }
        return `http://${this.IP_ADDRESS}:3000`;
    }
};
