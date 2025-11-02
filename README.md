SmartWed 💍 — React Native (Expo) + Firebase

This is the SmartWed mobile application, developed using React Native
 with Expo
 and integrated with Firebase
.
The project provides a cross-platform solution for couples, vendors, and guests to manage and coordinate wedding-related activities efficiently.

⚙️ Getting Started
1. Install dependencies
npm install

2. Start the application
npx expo start


In the terminal output, you’ll see options to open the app in:

A development build

An Android emulator

An iOS simulator

The Expo Go
 app on your physical device

⚠️ Important Note — Firebase Configuration

The file firebaseConfig.js is intentionally excluded from this repository for security reasons.
It contains private Firebase API credentials specific to the SmartWed project.

To run the project locally, create your own firebaseConfig.js file inside the root directory and include your Firebase credentials, for example:

// firebaseConfig.js
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export const app = initializeApp(firebaseConfig);


⚠️ Do not upload your firebaseConfig.js file or API keys to public repositories.


🧰 Useful Commands

Reset to a blank project (removes demo screens):

npm run reset-project


Build a standalone app:

npx expo prebuild

☁️ Deployment Notes

The SmartWed RSVP page (located in the rsvpWeb/ directory) is deployed using Firebase Hosting.
This allows guests to easily access and submit RSVP responses via a web interface.

Firebase Hosting ensures a secure and reliable deployment process, automatically managing SSL certificates, CDN distribution, and real-time updates.
To deploy the RSVP web page, use the following commands:

firebase login
firebase init hosting
firebase deploy


After deployment, the live RSVP link can be shared with guests for seamless online confirmation of attendance.
