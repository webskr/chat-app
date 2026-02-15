# Setting up Firebase for Android Push Notifications

To receive Push Notifications in an **APK (Development or Production)**, you **MUST** configure Firebase Cloud Messaging (FCM). Expo's default credentials only work in Expo Go.

## 1. Create a Firebase Project
1.  Go to [Firebase Console](https://console.firebase.google.com/).
2.  Click **Add project** and name it (e.g., `Chat App`).

## 2. Add an Android App
1.  Click the **Android icon** to add an app.
2.  **Android package name**: Must match your `app.json` package name (`com.skr.chatapp`).
3.  Click **Register app**.

## 3. Download Configuration File
1.  Download **`google-services.json`**.
2.  Move this file to your project's **root directory** (`c:\xampp\htdocs\chat-app\google-services.json`).

## 4. Update `app.json`
Add the path to the file in your `app.json` under `android`:

```json
{
  "expo": {
    "android": {
      "package": "com.skr.chatapp",
      "googleServicesFile": "./google-services.json",
      ...
    }
  }
}
```

## 5. Upload Service Account Key to EAS
1.  In Firebase Console: **Project settings** > **Service accounts**.
2.  Click **Generate new private key**.
3.  Run this command in your project to upload it to EAS:
    ```bash
    eas credentials
    ```
    - Select **Android**.
    - Select **Development** (or whichever profile you are building for).
    - Choose **Update/Upload FCM Key** (or Service Account Key).
    - Upload the JSON file you just generated.

## 6. Rebuild the APK
After these changes, you **must rebuild your APK**:
```bash
npx eas build -p android --profile development
```
