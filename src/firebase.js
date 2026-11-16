/**
 * firebase.js — Firebase app setup + Firebase AI Logic model factory.
 *
 * This is the ONLY module that imports the Firebase SDK. Everything else
 * talks to it through two functions:
 *
 *   getFirebaseStatus() -> { configured: boolean, missing: string[] }
 *   createHybridModel(mode) -> GenerativeModel (Firebase AI Logic)
 *
 * If the Firebase config is missing (no .env yet), the app still runs:
 * the deterministic SEO audit works fully, and the AI panel shows the
 * setup instructions instead of failing. See firebase-setup.md for the
 * exact steps to create the Firebase project and fill in the config.
 *
 * No API keys or secrets are hard-coded anywhere in this repo. The config
 * comes from Vite environment variables (VITE_FIREBASE_*), loaded from
 * a local .env file that is git-ignored.
 */

import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const REQUIRED_CONFIG_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];

function readConfig() {
  const env = import.meta.env || {};
  const missing = REQUIRED_CONFIG_KEYS.filter(
    (key) => !env[key] || String(env[key]).startsWith("YOUR_")
  );
  return {
    configured: missing.length === 0,
    missing,
    config: {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    },
    appCheckDebug: String(env.VITE_APPCHECK_DEBUG || "").toLowerCase() === "true",
    recaptchaSiteKey: env.VITE_RECAPTCHA_V3_SITE_KEY || "",
  };
}

let app = null;
let ai = null;
let db = null;
let auth = null;
let initError = null;

function ensureApp() {
  if (app) return app;
  if (initError) throw initError;
  const { configured, config, appCheckDebug, recaptchaSiteKey } = readConfig();
  if (!configured) {
    throw new Error("Firebase is not configured — see firebase-setup.md");
  }

  try {
    app = initializeApp(config);

    // Firebase AI Logic enforces App Check. For local development the
    // debug provider is used (debug tokens are accepted in submissions);
    // in production a reCAPTCHA v3 site key is required.
    try {
      if (appCheckDebug) {
        // The debug token is printed to the browser console on first run
        // and must be registered in the Firebase console (see
        // firebase-setup.md step 4). Setting this flag makes the SDK use
        // the debug provider instead of reCAPTCHA.
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      if (recaptchaSiteKey) {
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(recaptchaSiteKey),
          isTokenAutoRefreshEnabled: true,
        });
      } else if (appCheckDebug) {
        // Debug mode without a site key: initialize App Check with the
        // debug provider active. If this throws (for example an
        // unregistered debug token), the app keeps working and AI calls
        // will surface the real error.
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider("debug-placeholder"),
          isTokenAutoRefreshEnabled: true,
        });
      }
    } catch (appCheckErr) {
      console.warn("[RankLens] App Check init failed (AI calls may fail):", appCheckErr);
    }

    // Gemini Developer API backend — free tier, recommended by the
    // Firebase AI Logic setup guide for getting started.
    ai = getAI(app, { backend: new GoogleAIBackend() });
    db = getFirestore(app);
    auth = getAuth(app);
    return app;
  } catch (err) {
    initError = err;
    throw err;
  }
}

export function getFirebaseStatus() {
  const { configured, missing } = readConfig();
  return { configured, missing, initError: initError ? String(initError) : null };
}

/**
 * Create a Firebase AI Logic hybrid model for the given inference mode.
 *
 * On-device model: Gemini Nano in Chrome (desktop, v139+) via the Prompt
 * API, configured with a short SEO-assistant system prompt.
 * Cloud fallback: the SDK default (gemini-3.5-flash-lite from SDK v13),
 * which keeps the free tier generous. Override with inCloudParams if a
 * stronger cloud model is wanted.
 */
export function createHybridModel(mode) {
  ensureApp();
  const inferenceMode = InferenceMode[mode];
  if (!inferenceMode) throw new Error(`Unknown inference mode: ${mode}`);

  return getGenerativeModel(ai, {
    mode: inferenceMode,
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
        initialPrompts: [
          {
            role: "system",
            content: [
              {
                type: "text",
                value:
                  "You are RankLens, a concise SEO assistant. Answer in plain English, " +
                  "short sentences, no jargon, no filler. Never invent facts about the page.",
              },
            ],
          },
        ],
      },
    },
  });
}

/**
 * Save an audit to Firestore (optional, best-effort). Anonymous auth is
 * used so no sign-in screen is needed. Failures are swallowed — local
 * history (localStorage) is the primary store.
 */
export async function saveAuditToCloud(auditRecord) {
  try {
    ensureApp();
    if (!auth.currentUser) await signInAnonymously(auth);
    await addDoc(collection(db, "audits"), {
      ...auditRecord,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.warn("[RankLens] Cloud save failed (local copy kept):", err);
    return false;
  }
}
