export const Config = {
    // -------------------------------------------------------------------------
    // API CONFIGURATION
    // -------------------------------------------------------------------------
    // Set USE_LOCALHOST to:
    //   false -> To use your computer's IP (Recommended for Physical Devices & Emulators)
    //   true  -> To use 'localhost' (Only works for Web or iOS Simulator)
    // -------------------------------------------------------------------------
    USE_LOCALHOST: false, // <--- TOGGLE THIS

    // Your local Machine IP (Updated: 2026-02-01)
    // If this changes, run 'ipconfig' in terminal to find the new IPv4 Address.
    IP_ADDRESS: '172.24.228.5',

    // Android Emulator special alias (10.0.2.2 = localhost of host machine)
    // Use this if the IP method doesn't work on Android Emulator
    ANDROID_EMULATOR_IP: '10.0.2.2',

    get API_URL() {
        if (this.USE_LOCALHOST) {
            return 'http://localhost/chat-app/backend';
        } else {
            // Defaulting to IP address which works for both Physical & Emulator (usually)
            return `http://${this.IP_ADDRESS}/chat-app/backend`;
        }
    },
    get SOCKET_URL() {
        if (this.USE_LOCALHOST) {
            return 'http://localhost:3000';
        } else {
            return `http://${this.IP_ADDRESS}:3000`;
        }
    }
};
