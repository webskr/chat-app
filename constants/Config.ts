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
    IP_ADDRESS: '10.218.66.5',

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
                if (url.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
                    return `${url.protocol}//${url.hostname}:3000`;
                }
                return `${url.protocol}//${url.hostname}`;
            } catch (e) {
                return `http://${this.IP_ADDRESS}:8082`;
            }
        }

        if (this.USE_LOCALHOST) {
            return 'http://localhost:3000';
        }
        return `http://${this.IP_ADDRESS}:8082`;
    },

    // -------------------------------------------------------------------------
    // FIREBASE CONFIGURATION (Passwordless Auth)
    // -------------------------------------------------------------------------
    // Get these from Firebase Console -> Project Settings -> General -> Your Apps
    FIREBASE: {
        apiKey: "AIzaSyBHnSCEzVfGxszNU5P94w1wE45KAF--BIM",
        authDomain: "vegram-fbf53.firebaseapp.com",
        projectId: "vegram-fbf53",
        storageBucket: "vegram-fbf53.firebasestorage.app",
        messagingSenderId: "540675485477",
        appId: "1:540675485477:android:749d600c323c8912fc74cc"
    },
    
    // The deep link URL that Firebase will redirect back to.
    // Example: https://chatapp.page.link/login or your verified app domain
    AUTH_REDIRECT_URL: "https://vegram-fbf53.firebaseapp.com/finish-login"
};

