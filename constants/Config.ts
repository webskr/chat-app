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
            try {
                const url = new URL(this.BACKEND_URL);
                // If it's a typical local IP or localhost, use port 8082
                // (Cloudflare tunnels usually proxy to 8082 anyway if configured for single-tunnel)
                if (url.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
                    return `${url.protocol}//${url.hostname}:8082`;
                }
                // For ngrok/cloudflare (non-IP hostnames), we might use the base URL (port 80 proxy)
                return `${url.protocol}//${url.hostname}`;
            } catch (e) {
                return `http://${this.IP_ADDRESS}:8082`;
            }
        }

        if (this.USE_LOCALHOST) {
            return 'http://localhost:8082';
        }
        return `http://${this.IP_ADDRESS}:8082`;
    }
};
