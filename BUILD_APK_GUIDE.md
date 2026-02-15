# How to Build an Android APK/AAB

## Prerequisites
1.  **EAS CLI**: You need the Expo Application Services CLI installed globally.
    ```bash
    npm install -g eas-cli
    ```
2.  **Expo Account**: You need an account on [expo.dev](https://expo.dev).
    ```bash
    eas login
    ```

## Configuration
1.  **Initialize EAS**:
    Run this command in your project root:
    ```bash
    eas build:configure
    ```
    - Select `Android`.
    - It will generate an `eas.json` file.

2.  **Configure Build Profiles**:
    Open `eas.json` and ensure you have profiles for `development` (for testing push notifications) and `preview` (for APK distribution).

    Example `eas.json`:
    ```json
    {
      "cli": {
        "version": ">= 7.0.0"
      },
      "build": {
        "development": {
          "developmentClient": true,
          "distribution": "internal"
        },
        "preview": {
          "distribution": "internal",
          "android": {
            "buildType": "apk" 
          }
        },
        "production": {
          "autoIncrement": true
        }
      }
    }
    ```
    > **Note**: `preview` builds an APK you can install directly on your phone. `development` builds a custom "Expo Go"-like app that supports your native modules (like push notifications).

## Building the App

### Option A: Development Build (Recommended for Testing)
This creates a custom app that replaces Expo Go for your project. It supports Push Notifications.
```bash
eas build --platform android --profile development
```
- Install the resulting APK on your device.
- Run `npx expo start --dev-client` to connect to it.

### Option B: Preview APK (For Sharing)
This creates a standalone APK that can be installed on any Android device.
```bash
eas build --platform android --profile preview
```
- Download and install the APK.
- Note: Requires backend server to be accessible (e.g., via Ngrok or public IP) if testing on a real device outside your local network.

### Option C: Production Bundle (For Play Store)
This creates an AAB file for upload to Google Play Console.
```bash
eas build --platform android --profile production
```
