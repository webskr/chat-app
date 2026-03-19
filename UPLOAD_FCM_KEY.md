# Upload Firebase Service Account Key (Manual Step)

I was unable to navigate the interactive `eas credentials` menu automatically. You must upload the Service Account Key manually to enable Push Notifications in your Android Build.

**The Service Account Key file is located at:**
`c:\xampp\htdocs\chat-app\vegram-459ba-firebase-adminsdk-fbsvc-50627e0df3.json`

## Steps to Upload

1.  Open your terminal in `c:\xampp\htdocs\chat-app`.
2.  Run the following command:
    ```bash
    npx eas credentials
    ```
3.  Select **Android**.
4.  Select **development** profile.
5.  Select **Google Service Account**.
6.  Select **Manage your Google Service Account Key for FCM V1**.
7.  Select **Upload your own Google Service Account Key**.
8.  When asked for the path, enter:
    `vegram-459ba-firebase-adminsdk-fbsvc-50627e0df3.json`
9.  Confirm the upload.

## ⚠️ CRITICAL: Security Step ⚠️

**IMMEDIATELY AFTER UPLOADING:**
Run this command to delete the secret key file:
```bash
del vegram-459ba-firebase-adminsdk-fbsvc-50627e0df3.json
```

**Never commit this file to Git.** (I have already added `*.json` to `.gitignore` to prevent this).

## After Uploading
Once you have uploaded the key and deleted the file, run the build command again:

```bash
npx eas build -p android --profile development
```
