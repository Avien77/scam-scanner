# Scam Scanner — Expo app

## Requirements

- **Node.js 20.19+** (Expo SDK 54)
- **Expo Go** on your phone should match **SDK 54** (update from the store if needed)

## Run

1. **Backend** (from repo root):

   ```bash
   npm run backend
   ```

2. **Mobile app** (this folder):

   ```bash
   npx expo start
   ```

   Or from repo root: `npm run expo`

## API URL

- **Android emulator** on the same PC: defaults to `http://10.0.2.2:3001` (already set in `App.js`).
- **Physical phone (Expo Go)**: your computer’s LAN IP, e.g. `http://192.168.1.42:3001`.

  Create `mobile/.env`:

  ```env
  EXPO_PUBLIC_API_URL=http://YOUR_PC_LAN_IP:3001
  ```

  Restart Expo after changing `.env`.

- **Expo web**: often `http://127.0.0.1:3001` works if the backend runs on the same machine.

The app shows the API base on screen so you can confirm it’s correct.

## Flow

1. Tap **Gallery** or **Camera** to pick/take a screenshot.
2. Tap **Extract text (Textract)**.
3. Read the text in the **Extracted text** section.

Images are converted to **JPEG** before upload so AWS Textract accepts them (it does **not** support HEIC, which iPhones often use).

## Firewall

If the phone can’t reach the backend, allow **port 3001** inbound on Windows Firewall for your private network.

The backend is configured to listen on **all network interfaces** (`0.0.0.0`), not only localhost, so other devices on your LAN can connect.

## “Network request failed”

1. Confirm the app shows **API: http://192.168.x.x:3001** (your PC’s Wi‑Fi IP), not `127.0.0.1`.
2. If it still shows `127.0.0.1` on a real phone, add `mobile/.env`:
   `EXPO_PUBLIC_API_URL=http://YOUR_PC_LAN_IP:3001` and restart Expo (`npx expo start --clear`).
3. On Windows, run `ipconfig` and use the **IPv4** address of your Wi‑Fi adapter.

