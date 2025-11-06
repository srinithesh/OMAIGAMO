# OMAIGAMO - Backend Server (Node.js & Gemini)

This directory contains the professional Node.js backend for the OMAIGAMO application, built with Express. It handles file uploads, performs real AI-based video analysis using the Gemini API, and serves data to the frontend.

## Prerequisites

- **Node.js**: You must have Node.js (v18 or newer) installed.
- **FFMPEG**: This is required for video processing. The package `fluent-ffmpeg` will use `@ffmpeg-installer/ffmpeg` to handle this automatically, but a system-level install is more robust.
- **Firebase Project (Optional)**: For storing analysis results. If you don't have one, the server will still run but will log warnings about being unable to save to Firestore.

## Setup and Running the Server

### 1. Configure Firebase (Optional)

If you wish to store analysis results persistently:
- Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
- Go to Project Settings > Service Accounts.
- Click "Generate new private key" to download your `serviceAccountKey.json` file.
- **Place the `serviceAccountKey.json` file in this `backend` directory.**
- Enable Firestore in your Firebase project console.

### 2. Configure Environment Variables

Create a file named `.env` in this `backend` directory and add the following, replacing the placeholder with your actual key:

```
# Your Gemini API Key
API_KEY="YOUR_GEMINI_API_KEY"

# (Optional) Your Firebase Storage Bucket URL (e.g., your-project-id.appspot.com)
FIREBASE_STORAGE_BUCKET="YOUR_FIREBASE_STORAGE_BUCKET"
```

### 3. Install Dependencies

Open your terminal in this `backend` directory and run:

```bash
npm install
```

### 4. Start the Server

```bash
node server.js
```

The server will start and listen on `http://127.0.0.1:8000`. You must keep this terminal window open while using the application.