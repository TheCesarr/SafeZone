# Implementation Plan - Notification Sounds

The goal is to add auditory feedback for key user interactions and system events, mimicking Discord's experience.

## Goal Description
Implement a system to play sound effects for:
1.  **Channel Join/Leave**: When a user enters/leaves a voice channel.
2.  **Message Received**: When a text message arrives.
3.  **Mute/Deafen Toggle**: Local user toggles settings.
4.  **Screen Share**: Start/Stop indication.
5.  **User Connect/Disconnect**: Global or friends? (Focus on Voice Channel events).

## Proposed Changes

### 1. Assets (Sound Files)
Since I cannot "upload" MP3s, I will use:
-   Standard HTML5 Audio with base64 encoded short sounds if possible.
-   OR use online placeholder URLs (Open source sounds).
-   *Better approach*: I will create a `sounds.js` utility that contains Base64 strings for simple beeps/bloops, OR I will assume the user will replace them with real files later. I can create a synthesis helper (Web Audio API) to generate "beeps" without external files! This is cleaner and self-contained.

### 2. New Utility: `src/utils/SoundManager.js`
-   `playSound(type)` function.
-   Uses Web Audio API (Oscillator) to generate sounds dynamically (retro/synth style) OR plays Audio objects if file paths provided.
-   I will implement **Web Audio API synthesis** for "Join" (High-Low chime), "Leave" (Low-High), "Mute" (Click), "Message" (Ding). This ensures it works out-of-the-box without missing assets.

### 3. Integration in `App.jsx`
-   **Message Sounds**: In `handleIncomingMessage` (via WebSocket).
-   **Voice Events**: In `roomWs.onmessage`.
    -   When `user_joined` event received -> `SoundManager.play('join')`.
    -   When `user_left` event received -> `SoundManager.play('leave')`.
-   **Local Actions**:
    -   `toggleMute` -> `SoundManager.play('mute_on' / 'mute_off')`.
    -   `toggleDeafen` -> `SoundManager.play('deafen_on' / 'deafen_off')`.
    -   `startScreenShare` -> `SoundManager.play('screen_share')`.

## detailed Logic

### `SoundManager.js` (Web Audio API)
-   `playJoin()`: Ascending arpeggio.
-   `playLeave()`: Descending arpeggio.
-   `playMessage()`: Short "Ding" (Sine wave).
-   `playMute(isMuted)`: Short click/toggle sound.
-   `playDeafen(isDeafened)`: Deeper toggle sound.

### Connect Triggers
-   **App.jsx**:
    -   Watch `messages` state? No, listen to WS event directly to avoid re-render loops.
    -   Watch `roomDetails` or `connectedUsers`? Better to hook into the `onmessage` handler of `roomWs` and `chatWs`.

## Verification Plan
-   **Manual Test**:
    -   Send message from another tab -> Hear 'Ding'.
    -   Join voice channel -> Hear 'Chime'.
    -   Click Mute button -> Hear 'Click'.
