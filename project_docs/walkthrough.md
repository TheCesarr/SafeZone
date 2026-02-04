# Notification Sounds Implementation

I have implemented a **SoundManager** that uses the browser's Web Audio API to generate pleasant notification sounds without requiring any external MP3 files.

## Features Added

### 1. Sound Manager (`src/utils/SoundManager.js`)
A utility class that synthesizes retro/modern UI sounds on the fly:
-   **Join**: Ascending chime (Happy).
-   **Leave**: Descending chime.
-   **Message**: Soft "Ding".
-   **Mute/Deafen**: Mechanical click sounds (Toggle On/Off).
-   **Screen Share**: Sci-fi activation sound.

### 2. Event Integration (`App.jsx`)
The sounds are triggered automatically on:
-   **Usage**: Send/Receive message from another user.
-   **Voice**: Join or Leave a voice channel (triggers when *others* join/leave too).
-   **Controls**: Clicking Mute, Deafen, or Screen Share buttons.

## How to Test
1.  **Mute/Deafen**: Click the microphone/headphone icons in the user footer. You should hear a click.
2.  **Voice Channel**: Join a channel. You will hear a confirmation chime.
3.  **Messaging**: Open a second tab, login as a different user, and send a message. The first tab will play a "ding".

## Code Changes
-   Created `SoundManager.js`.
-   Modified `App.jsx` to import `SoundManager`.
-   Restored/Updated `toggleMute`, `toggleDeafen`, and `stopScreenShare` functions to include sound triggers.
