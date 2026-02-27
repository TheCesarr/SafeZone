# WebRTC & Auth Stabilization Plan

The user reported five key issues that are severely impacting the experience:
1. **Screen Share Flickering**: When a user shares their screen, the video flickers repeatedly.
2. **WebRTC Voice Connection Issues**: In a room with 4 people, a user might only hear 2 of them (partial mesh connection).
3. **Auto-Login Failure**: Users are forced to log in again after application restart.
4. **User Volume Reset**: Individually adjusted user volumes reset to 100% and are not persisted across sessions or reconnects.
5. **Roles Not Working**: Roles can be created, but there is no UI to assign them to members.

## Proposed Changes

### 1. Fix Auto-Login Persistence
**Root Cause**: While `useAuth.js` checks `localStorage` on mount, `App.jsx` might render the authentication screen before the check completes, or electron's lifecycle destroys the memory context before the React Router correctly handles the auto-login.
#### [MODIFY] `src/hooks/useAuth.js`
- Create a synchronous initial state read from `localStorage` so that the `authState.token` is populated *immediately* on the first render, avoiding the flash of the login screen.
- Set `isLoading` to false only after the server `/auth/verify` call confirms the token is valid, rendering a loading spinner in the meantime instead of the login screen.

### 2. Fix Screen Share Flickering
**Root Cause**: The `<video>` element playing the screen share is tied directly to the React component tree and is re-rendering every time any user's voice state (like `isSpeaking`) changes.
#### [MODIFY] `src/components/VoiceRoom.jsx`
- Wrap the `<video>` element specifically in a `React.memo` component, or use `useRef` to manage the video `srcObject` manually outside of the React render cycle.
- Ensure that the remote screen stream `audio` track is not accidentally routed to the standard voice grid.

### 3. Stabilize WebRTC Mesh Connections
**Root Cause**: Currently, `useWebRTC.js` relies on a single `please_offer` broadcast to initiate peer connections. If a connection drops, an ICE candidate fails, or a user joins at the exact wrong millisecond, the connection is never renegotiated.
#### [MODIFY] `src/hooks/useWebRTC.js`
- Implement a **Renegotiation Interval**: Add a `setInterval` (e.g., every 5-10 seconds) that checks the `activeUsersRef` against the `peerConnections.current` object. If a user is in the room but has no active `RTCPeerConnection` (or if it's in a `failed` state), automatically create a new offer.
- Add `pc.oniceconnectionstatechange` listener to actively detect `disconnected` and `failed` states. If a connection fails, tear it down and trigger a fresh renegotiation.

### 4. Persist Individual User Volumes
**Root Cause**: User-specific volume adjustments are stored in transient React state within the `<audio>` slider logic and are not saved to disk. When the room is left and rejoined, or the app restarted, `<audio>` elements default to `volume = 1.0`.
#### [MODIFY] `src/components/VoiceRoom.jsx`
- Create a `userVolumes` state initialized from `localStorage.getItem('safezone_user_volumes')`.
- When a user changes a volume slider, update the state, apply it to the `<audio>` element, and save the updated dictionary back to `localStorage`.
- When rendering or mounting `<audio>` elements for remote users, ensure their volume is immediately set to the value from `userVolumes[uuid]` or `1.0` if not set.

### 5. Implement Role Assignment UI
**Root Cause**: The backend fully supports creating and assigning roles via endpoints (`/server/{id}/roles/{id}/assign`), and `ServerSettings.jsx` can create new roles. However, there is no UI anywhere in the app to actually assign these roles to a user.
#### [MODIFY] `src/components/ProfileCard.jsx`
- Fetch the full list of server roles when the ProfileCard opens.
- Render a "Manage Roles" dropdown or `+` button in the Roles section.
- If the current user has `MANAGE_ROLES` permission (or is SysAdmin/Server Owner), allow them to toggle `assign`/`unassign` API requests for the target user.

## Verification Plan

### Automated/Manual Verification
1. **Auth Test**: Log in, fully close the Electron client, and reopen it. The user should be brought directly to the lobby without seeing the login screen.
2. **WebRTC Voice Test**: Have 3+ users connect to a voice channel, simulate a network drop or late join, and verify that the auto-renegotiation loop successfully connects all peers.
3. **Screen Share Test**: Start a screen share while multiple people are speaking (triggering rapid state updates). Verify the `<video>` element remains stable with no black-screen flickering.
