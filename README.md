# Vegram - Development Guide

## Local Development with Local IP

To test the application on physical devices or emulators on the same network, we use the machine's local IP address.

### Prerequisites
- PC and mobile device must be on the **same Wi-Fi network**.
- Apache and MySQL (via XAMPP) must be running.

### Steps to Setup

1.  **Start the Backend Servers**:
    - Ensure your Apache server (XAMPP) is running for the PHP backend.
    - Start the Node.js socket server:
      ```powershell
      npm run socket-server
      ```

2.  **Update Frontend Configuration**:
    - Open the `.env` file in the root directory.
    - Set `EXPO_PUBLIC_BACKEND_URL` to your local IP address (e.g., `10.130.145.5`):
      ```env
      EXPO_PUBLIC_BACKEND_URL=http://10.130.145.5/chat-app/backend
      ```
    - Check `constants/Config.ts` to ensure `IP_ADDRESS` matches if fallback is needed.

3.  **Start Expo**:
    - Start the Expo development server:
      ```powershell
      npx expo start -c
      ```

### Multi-Instance Shortcut
You can use the provided script to start both the socket server and expo in separate windows:
```powershell
./start-instance.ps1
```

### Troubleshooting
- **Firewall**: Ensure your computer's firewall allows incoming connections on ports 80 (Apache), 3000 (Socket), and 8081 (Expo).
- **Network Isolation**: Some public Wi-Fi networks prevent devices from talking to each other. Use a home network or mobile hotspot if possible.
