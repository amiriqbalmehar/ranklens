# RankLens — Firebase setup (what Muhammad must create)

The app is fully built, but Firebase AI Logic needs **his** Google account —
a Firebase project and its config cannot be created by anyone else. This
guide is the exact sequence. About 10 minutes, no payment needed (the
Gemini Developer API backend has a free tier, and on-device inference is
free).

## Step 1 — Create a Firebase project

1. Go to https://console.firebase.google.com/ and sign in with your Google account.
2. Click **Add project** (or **Create a project**).
3. Name it `ranklens` (any name works) and click **Continue**.
4. When asked about Google Analytics: **you can skip it** — it is not needed for AI Logic.
5. Wait for the project to be created, then click **Continue** to open it.

## Step 2 — Enable AI Logic (guided setup)

1. In the Firebase console, go to **AI services > AI Logic** (left menu).
2. Click **Get started**. The guided workflow sets up the required APIs.
3. When asked to choose a **Gemini API provider**, choose **Gemini Developer API** (free, fastest start).
4. Complete the workflow. Note: this step **automatically enforces Firebase App Check** for AI Logic — that is expected, and step 4 below handles local development.

## Step 3 — Register the web app and copy the config

1. In the console, go to **Project settings** (gear icon, top left) **> Your apps**.
2. Click the **Web** icon (`</>`) to add a web app. Give it a nickname (e.g. `ranklens-web`) and click **Register app**.
3. Copy the `firebaseConfig` object shown on screen. It looks like this (values will be different):

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "ranklens-xxxxx.firebaseapp.com",
  projectId: "ranklens-xxxxx",
  storageBucket: "ranklens-xxxxx.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef..."
};
```

4. In the project folder, copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

5. Fill in the six values in `.env` (replace the `YOUR_...` placeholders). **Do not commit `.env`** — it is git-ignored. The `apiKey` here is a browser key (it is meant to be public in a web app), but keep `.env` out of the repo anyway.

## Step 4 — App Check debug token (local development)

AI Logic enforces App Check, so local development needs a debug token:

1. Make sure `.env` has `VITE_APPCHECK_DEBUG=true`.
2. Run the app: `npm run dev`, open http://localhost:5173.
3. Open the browser console (F12 → Console). You will see a line like:

```
AppCheck debug token: "123a4567-b89c-12d3-e456-789012345678".
You will need to safelist it in the Firebase console for it to work.
```

4. Copy that token. In the Firebase console, go to **Security > App Check > Apps** tab.
5. Find your web app, click the **⋮** (overflow) menu → **Manage debug tokens** → add the token.
6. Reload the page. AI calls will now pass App Check.

(For a deployed production version, add a reCAPTCHA v3 site key to `.env` as `VITE_RECAPTCHA_V3_SITE_KEY` and set `VITE_APPCHECK_DEBUG=false`. Not needed for the hackathon submission — debug tokens are explicitly accepted.)

## Step 5 — Enable on-device inference in Chrome

On-device inference (Gemini Nano) needs desktop Chrome 139+:

1. Update Chrome: `chrome://settings/help` — confirm version 139 or higher.
2. Go to `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and set it to **Enabled**.
3. Restart Chrome.
4. The first time you click an AI button in RankLens, the model downloads automatically — the app shows a progress bar. To pre-download it, open DevTools → Console and run:

```js
await LanguageModel.create();
```

   (Wait until it resolves; the model is a few hundred MB.)

## Step 6 — Verify it works

```bash
npm run dev
```

1. Open http://localhost:5173 — the header should say **"Firebase: connected"**.
2. Click **Load sample page** → the audit runs (58/100, "Needs work").
3. Click **Summarize this page**. The answer should appear with a green **"Ran on-device · Gemini Nano"** badge (if the model is downloaded) or a blue **"Ran in cloud · Gemini"** badge (if not — the fallback working is also a valid demo).
4. Switch the mode to **Cloud only** and click **Content brief** — the answer should show the cloud badge.
5. Record the demo video (see `demo-video-script.md`).

## Optional — Firestore backup

The app tries to save each audit to a Firestore collection called `audits` (anonymous auth, best-effort — the local history always works regardless). To enable it:

1. Console → **Build > Firestore Database** → **Create database** → start in **production mode**, pick a location.
2. Console → **Build > Authentication** → **Sign-in method** → enable **Anonymous**.
3. Rules (start here, tighten later if the app goes public):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /audits/{auditId} {
      allow create: if request.auth != null;
      allow read: if false;
    }
  }
}
```

If Firestore is not set up, the app logs a console warning and keeps working — the cloud save is never required.

## Optional — deploy (for the Devpost "hosted project" link)

Firebase Hosting is the simplest host for this app:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # public directory: dist, single-page app: yes
npm run build
firebase deploy
```

A hosted URL is "highly encouraged" by the hackathon but not required — the repo + video are the required parts.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Firebase: not configured" in the header | `.env` is missing or has `YOUR_...` placeholders — see step 3. Restart `npm run dev` after editing `.env`. |
| AI fails with an App Check error | Debug token not registered — see step 4. |
| "On-device only" fails | Gemini Nano not downloaded — see step 5, or use "Prefer on-device" (falls back to cloud). |
| AI fails with a quota/permission error | Check the AI Logic guided setup completed (step 2) and the Gemini Developer API is selected. |
| Everything works except Firestore save | Firestore/anonymous auth not enabled — optional, see above. The app works without it. |
