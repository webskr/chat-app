---
description: How to create an Android Development Build for testing native features
---

# Creating an Android Development Build

Since Expo Go doesn't support the granular audio permissions needed for `expo-media-library`, you must create a development build to test these features.

## Prerequisites
1. Ensure you have an Expo account.
2. Ensure `eas-cli` is installed: `npm install -g eas-cli`
3. Log in to EAS: `eas login`

## Step 1: Initialize EAS (if not done)
// turbo
1. Run `eas build:configure`

## Step 2: Create a Development Build
You can build locally (requires Android Studio) or on Expo's cloud.

### Option A: Local Build (Recommended for speed)
// turbo
1. Run `npx expo run:android`

### Option B: Cloud Build (Easier setup)
// turbo
1. Run `eas build --profile development --platform android`
2. Once the build finishes, download the APK to your device/emulator.

## Step 3: Run the App
1. Start the dev server: `npx expo start`
2. Open the custom development build on your device.
3. It will connect to your dev server and all permissions in `app.json` will now work!
