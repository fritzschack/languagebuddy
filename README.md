# Language Buddy

A hands-free voice conversation partner for practicing a language with Claude.
You talk, Claude answers out loud in the language you're learning, and the
translations are there whenever you want them.

- **Hands-free loop.** Tap Start once. Claude speaks, then the app listens.
  Pause for a moment (1.6 s by default) and your turn is sent. Tap the big
  button while Claude is talking to interrupt.
- **Translation on demand.** Tap any line, or the Translate chip, to see it in
  your own language. "Show English" in the header reveals every line at once.
- **Your speech, processed.** Each thing you say is transcribed, translated
  back into your language, and checked. Real mistakes get a corrected sentence
  you can listen to, plus a one-line explanation.
- **Hints.** On any of Claude's lines: key words, a tip on how to answer, and
  two possible replies you can listen to.
- **"Ask in English."** Tap it and say what you want to say in your own
  language. Claude tells you how to say it, reads it out, then the
  conversation continues.
- **Any language pair.** Choose the language you're practicing, your own
  language, your level, and a situation (café, directions, job interview, …)
  in Settings.

The iOS app lives in [`app/`](app/) (Expo / React Native). [`web/`](web/)
holds an earlier prototype that runs as a page inside Claude.

## What you need

1. **A Claude API key.** Create one at <https://platform.claude.com> under
   API keys and add credit. The app asks for it on first launch and keeps it in
   the iPhone keychain. Usage is billed to that key. Haiku 5.5 is the default
   (fast and cheap); switch to Opus 5.5 in Settings for more careful corrections.
2. **An Apple Developer Program membership** ($99/year) to use TestFlight.
3. **A free Expo account** at <https://expo.dev>. Expo's EAS service builds
   the iOS app in the cloud, so you don't need a Mac.

## Put it on your iPhone with TestFlight

From a computer with Node.js 20 or newer:

```bash
cd app
npm install
npm install -g eas-cli
eas login                 # your Expo account
eas init                  # links this project to your Expo account
eas build --platform ios --profile production --auto-submit
```

The build asks you to sign in with your Apple ID. Let EAS create the
certificates and provisioning profile for you. If the bundle identifier
`com.fritzschack.languagebuddy` is already taken, change `ios.bundleIdentifier`
in `app/app.json`.

`--auto-submit` uploads the finished build to App Store Connect. After Apple
processes it (usually 10–30 minutes), open App Store Connect → your app →
TestFlight, add yourself as an internal tester, and install it from the
TestFlight app on your phone.

### Later builds from GitHub

Once the first build has worked, you can build from GitHub instead:

1. Create an access token at expo.dev → Account settings → Access tokens.
2. Add it to this repository as an Actions secret named `EXPO_TOKEN`.
3. Run **Actions → Build and send to TestFlight → Run workflow**.

## Developing

The app uses native speech recognition, so it does not run in Expo Go. Build
a development client once, then iterate with the dev server:

```bash
cd app
eas build --platform ios --profile development   # install on your phone
npx expo start --dev-client
```

Checks: `npx tsc --noEmit`.

### How it works

| File | Role |
| --- | --- |
| `app/src/useConversation.ts` | The voice loop: listening (`expo-speech-recognition`), end-of-turn detection by silence, Claude calls, speaking (`expo-speech`), interruptions |
| `app/src/claude.ts` | Claude prompts and structured outputs: the partner's reply with its translation; translation and correction of your line (run in parallel so the reply isn't delayed); hints; "how do I say …" |
| `app/src/components/` | Chat bubbles and the Settings sheet |
| `app/src/settings.ts` | Saved preferences; API key in the keychain via `expo-secure-store` |

Speech recognition and the voice both use Apple's built-in speech services,
so quality depends on the voices installed on the phone. For better voices,
go to iOS Settings → Accessibility → Spoken Content → Voices and download an
enhanced voice for your practice language.
