import { useRef, useState, useEffect } from 'react';
import { getUrl, STUN_SERVERS } from '../utils/api';
import SoundManager from '../utils/SoundManager';
import toast from '../utils/toast';
import { NoiseSuppression } from '../audio/NoiseSuppression';

export const useWebRTC = (authState, uuid, roomWs, onMessageReceived, selectedInputId, selectedOutputId, audioSettings) => {
    // Media & Connection Refs
    const localStream = useRef(null);
    const peerConnections = useRef({}); // { [uuid]: RTCPeerConnection }
    const remoteAudioRefs = useRef({}); // { [uuid]: HTMLAudioElement }
    const screenStreamRef = useRef(null);
    const activeUsersRef = useRef([]);
    const noiseSuppressionRef = useRef(null); // NoiseSuppression instance
    const processedStreamRef = useRef(null); // Noise-filtered MediaStream
    const [isNoiseCancelled, setIsNoiseCancelled] = useState(false);

    // Audio Analysis Refs
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);

    // State
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [activeVoiceChannel, setActiveVoiceChannel] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({}); // For Video/ScreenShare { [uuid]: MediaStream }
    const [connectedUsers, setConnectedUsers] = useState([]);
    const [speakingUsers, setSpeakingUsers] = useState(new Set());

    // Voice States Map { [uuid]: { isMuted, isDeafened, isScreenSharing } }
    const [voiceStates, setVoiceStates] = useState({});

    // Helper: Send Signal via WebSocket
    const sendSignal = (data) => {
        if (roomWs.current?.readyState === WebSocket.OPEN) {
            roomWs.current.send(JSON.stringify({ ...data, uuid: uuid.current }));
        }
    }

    // --- SIGNAL HANDLING ---
    const handleVoiceMessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (msg.target && msg.target !== uuid.current) return;

        if (msg.type === 'user_list') {
            setConnectedUsers(msg.users);
            activeUsersRef.current = msg.users;

            // Sync voice states
            const states = {};
            msg.users.forEach(u => {
                states[u.uuid] = { isMuted: u.is_muted, isDeafened: u.is_deafened, isScreenSharing: u.is_screen_sharing };
            });
            setVoiceStates(prev => ({ ...prev, ...states }));
        } else if (msg.type === 'chat' || msg.type === 'history') {
            // Pass to Chat Hook
            if (onMessageReceived) onMessageReceived(msg);
        } else if (msg.type === 'user_state') {
            setVoiceStates(prev => ({
                ...prev,
                [msg.uuid]: { isMuted: msg.is_muted, isDeafened: msg.is_deafened, isScreenSharing: msg.is_screen_sharing }
            }));
        } else if (msg.type === 'speaking') {
            if (msg.is_speaking) setSpeakingUsers(prev => new Set([...prev, msg.uuid]));
            else setSpeakingUsers(prev => { const n = new Set(prev); n.delete(msg.uuid); return n; });
        } else if (msg.type === 'system' && msg.action === 'please_offer') {
            startMeshConnection(msg.users || activeUsersRef.current);
        } else if (msg.type === 'offer') {
            if (msg.uuid === uuid.current) return
            await handleOffer(msg)
        } else if (msg.type === 'answer') {
            const pc = peerConnections.current[msg.uuid];
            if (pc) await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
        } else if (msg.type === 'ice') {
            if (msg.uuid === uuid.current) return
            const pc = peerConnections.current[msg.uuid];
            if (pc) try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)) } catch (e) { }
        }
    }

    const connectingRef = useRef(null);

    // --- MAIN CONNECTION LOGIC ---
    const connectToRoom = async (channel) => {
        if (connectingRef.current === channel.id) return;
        if (activeVoiceChannel?.id === channel.id && roomWs.current?.readyState === WebSocket.OPEN) return;

        connectingRef.current = channel.id;

        if (roomWs.current) {
            roomWs.current.close();
            roomWs.current = null;
        }

        // Reset voice state only if switching to a DIFFERENT voice channel
        if (activeVoiceChannel && channel.type === 'voice' && activeVoiceChannel.id !== channel.id) {
            disconnectVoice();
        }

        // Get Media FIRST to avoid Race Condition (v1.3.5 Fix)
        if (channel.type === 'voice') {
            await startVoiceMedia(channel);
        }

        // Check if we are still targeting this channel (in case of fast switch)
        if (connectingRef.current !== channel.id) return;

        const wsUrl = getUrl(`/ws/room/${channel.id}/${uuid.current}`, 'ws');
        roomWs.current = new WebSocket(wsUrl);

        /* Clear previous voice states when connecting to new room */
        setVoiceStates({});

        roomWs.current.onopen = () => {
            if (channel.type === 'voice') {
                sendSignal({ type: 'user_state', is_muted: isMuted, is_deafened: isDeafened });
            }
        }

        roomWs.current.onmessage = handleVoiceMessage;
    }

    const startVoiceMedia = async (channel) => {
        try {
            // v1.3.6 Simplified Audio Constraints with Device Selection & Settings
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedInputId && selectedInputId !== 'default' ? { exact: selectedInputId } : undefined,
                    echoCancellation: audioSettings?.echoCancellation ?? true,
                    noiseSuppression: audioSettings?.noiseSuppression ?? true,
                    autoGainControl: audioSettings?.autoGainControl ?? true
                },
                video: false
            })
            localStream.current = stream;
            setActiveVoiceChannel(channel);

            // Apply current mute state to new stream
            stream.getAudioTracks().forEach(t => t.enabled = !isMuted);

            // Initialize RNNoise if noise cancellation is enabled
            if (isNoiseCancelled) {
                try {
                    const ns = new NoiseSuppression();
                    const processed = await ns.init(stream);
                    if (processed && processed !== stream) {
                        noiseSuppressionRef.current = ns;
                        processedStreamRef.current = processed;
                        console.log('[useWebRTC] RNNoise noise suppression active');
                    }
                } catch (e) {
                    console.error('[useWebRTC] Failed to init noise suppression:', e);
                }
            }

            SoundManager.playJoin();

            setupVoiceActivityDetection(stream);
        } catch (e) {
            toast.error("Mikrofon izni gerekli.");
            console.error(e);
        }
    }

    const disconnectVoice = () => {
        connectingRef.current = null;
        if (roomWs.current) roomWs.current.close();

        Object.values(peerConnections.current).forEach(pc => pc.close());
        peerConnections.current = {};

        // Stop Audio Elements
        Object.values(remoteAudioRefs.current).forEach(el => {
            el.srcObject = null;
            el.pause();
        });
        remoteAudioRefs.current = {};

        if (localStream.current) {
            localStream.current.getTracks().forEach(t => t.stop());
            localStream.current = null;
        }
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
        }

        setRemoteStreams({});
        setActiveVoiceChannel(null);
        setConnectedUsers([]);

        // Cleanup VAD
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        analyserRef.current = null;
        setSpeakingUsers(new Set());
        SoundManager.playLeave();

        // Cleanup noise suppression
        if (noiseSuppressionRef.current) {
            noiseSuppressionRef.current.destroy();
            noiseSuppressionRef.current = null;
            processedStreamRef.current = null;
        }
    }

    // --- WebRTC PEER HANDLING ---
    const createPC = (targetUuid) => {
        const pc = new RTCPeerConnection(STUN_SERVERS);

        if (localStream.current) {
            // Use processed (noise-filtered) stream if available, otherwise raw mic
            const audioStream = processedStreamRef.current || localStream.current;
            audioStream.getAudioTracks().forEach(track => pc.addTrack(track, audioStream));
        }
        if (screenStreamRef.current) {
            screenStreamRef.current.getVideoTracks().forEach(track => pc.addTrack(track, screenStreamRef.current));
        }

        pc.ontrack = (event) => {
            if (event.track.kind === 'audio') {
                let audioElement = remoteAudioRefs.current[targetUuid];
                if (!audioElement) {
                    audioElement = new Audio();
                    audioElement.autoplay = true;
                    audioElement.volume = 1.0;
                    audioElement.muted = isDeafened;
                    if (selectedOutputId && audioElement.setSinkId) {
                        audioElement.setSinkId(selectedOutputId).catch(console.error);
                    }
                    remoteAudioRefs.current = { ...remoteAudioRefs.current, [targetUuid]: audioElement };
                }

                audioElement.srcObject = event.streams[0];
                audioElement.play().catch(e => console.error("Play error", e));
            } else if (event.track.kind === 'video') {
                setRemoteStreams(prev => ({ ...prev, [targetUuid]: event.streams[0] }));
            }
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) sendSignal({ type: 'ice', candidate: event.candidate, target: targetUuid });
        }

        peerConnections.current[targetUuid] = pc;
        return pc;
    }

    const handleOffer = async (msg) => {
        const senderUuid = msg.uuid;
        let pc = peerConnections.current[senderUuid];
        if (!pc) pc = createPC(senderUuid);
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: 'answer', sdp: answer, target: senderUuid });
    }

    const startMeshConnection = async (users) => {
        if (!users) return;
        for (const user of users) {
            if (user.uuid === uuid.current) continue;
            if (peerConnections.current[user.uuid]) continue;

            const pc = createPC(user.uuid);
            try {
                const offer = await pc.createOffer({ offerToReceiveAudio: true });
                await pc.setLocalDescription(offer);
                sendSignal({ type: 'offer', sdp: offer, target: user.uuid });
            } catch (e) { }
        }
    }

    // --- DEVICE CHANGE EFFECTS ---

    // Switch Input Device (Hot-Swap)
    useEffect(() => {
        if (activeVoiceChannel && localStream.current) {
            console.log("Switching Input Device to:", selectedInputId);
            // Stop old tracks
            localStream.current.getTracks().forEach(t => t.stop());

            // Get new stream
            navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedInputId && selectedInputId !== 'default' ? { exact: selectedInputId } : undefined,
                    echoCancellation: audioSettings?.echoCancellation ?? true,
                    noiseSuppression: audioSettings?.noiseSuppression ?? true,
                    autoGainControl: audioSettings?.autoGainControl ?? true
                },
                video: false
            }).then(stream => {
                localStream.current = stream;
                // Apply mute state
                stream.getAudioTracks().forEach(t => t.enabled = !isMuted);

                // Replace tracks in PeerConnections
                Object.values(peerConnections.current).forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track.kind === 'audio');
                    if (sender) {
                        sender.replaceTrack(stream.getAudioTracks()[0]);
                    }
                });

                // Update VAD
                setupVoiceActivityDetection(stream);
            }).catch(e => console.error("Failed to switch input device", e));
        }
    }, [selectedInputId, audioSettings]);

    // Switch Output Device
    useEffect(() => {
        if (selectedOutputId) {
            console.log("Switching Output Device to:", selectedOutputId);
            Object.values(remoteAudioRefs.current).forEach(audio => {
                if (audio.setSinkId) {
                    audio.setSinkId(selectedOutputId).catch(e => console.error("Failed to set sinkId", e));
                }
            });
        }
    }, [selectedOutputId]);

    // --- VOICE ACTIVITY DETECTION (VAD) ---
    const setupVoiceActivityDetection = (stream) => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const audioContext = audioContextRef.current;
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.8;
            analyserRef.current = analyser;

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            let isSpeakingLocal = false;

            const update = () => {
                if (!analyserRef.current) return;
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b) / bufferLength;

                const THRESHOLD = 30;
                const SILENCE = 15;

                if (avg > THRESHOLD && !isSpeakingLocal) {
                    isSpeakingLocal = true;
                    setSpeakingUsers(prev => new Set([...prev, uuid.current]));
                    sendSignal({ type: 'speaking', is_speaking: true });
                } else if (avg < SILENCE && isSpeakingLocal) {
                    isSpeakingLocal = false;
                    setSpeakingUsers(prev => {
                        const n = new Set(prev); n.delete(uuid.current); return n;
                    });
                    sendSignal({ type: 'speaking', is_speaking: false });
                }
                animationFrameRef.current = requestAnimationFrame(update);
            }
            update();
        } catch (e) { console.error("VAD Auth Error", e); }
    }

    // --- CONTROLS ---
    const toggleMute = () => {
        if (isDeafened) return;
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        SoundManager.playMute(newMuted);
        if (localStream.current) {
            localStream.current.getAudioTracks().forEach(t => t.enabled = !newMuted);
        }
        // Update local voiceState immediately for UI
        setVoiceStates(prev => ({
            ...prev,
            [uuid.current]: { isMuted: newMuted, isDeafened, isScreenSharing }
        }));
        sendSignal({ type: 'user_state', is_muted: newMuted, is_deafened: isDeafened, is_screen_sharing: isScreenSharing });
    }

    const toggleDeafen = () => {
        const newDeafened = !isDeafened;
        setIsDeafened(newDeafened);
        SoundManager.playDeafen(newDeafened);

        // Mute all incoming audio
        Object.values(remoteAudioRefs.current).forEach(audio => { if (audio) audio.muted = newDeafened; });

        if (localStream.current) {
            localStream.current.getAudioTracks().forEach(track => track.enabled = newDeafened ? false : !isMuted);
        }
        // Update local voiceState
        setVoiceStates(prev => ({
            ...prev,
            [uuid.current]: { isMuted, isDeafened: newDeafened, isScreenSharing }
        }));
        sendSignal({ type: 'user_state', is_muted: isMuted, is_deafened: newDeafened, is_screen_sharing: isScreenSharing });
    }

    // --- SCREEN SHARE ---
    const startScreenShare = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            screenStreamRef.current = stream;

            // Handle stream stop (user clicks "Stop Sharing" in browser UI)
            stream.getVideoTracks()[0].onended = () => stopScreenShare();

            // Add ONLY video tracks to existing connections (keep audio untouched)
            const promises = Object.entries(peerConnections.current).map(async ([targetUuid, pc]) => {
                stream.getVideoTracks().forEach(track => pc.addTrack(track, stream));
                // If screen has audio, add that too but separately
                stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

                // Renegotiate
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                sendSignal({ type: 'offer', sdp: offer, target: targetUuid });
            });
            await Promise.all(promises);

            setIsScreenSharing(true);
            setVoiceStates(prev => ({
                ...prev,
                [uuid.current]: { isMuted, isDeafened, isScreenSharing: true }
            }));
            sendSignal({ type: 'user_state', is_muted: isMuted, is_deafened: isDeafened, is_screen_sharing: true });
        } catch (e) {
            console.error("Screen Share Error:", e);
        }
    }

    const stopScreenShare = async () => {
        if (!screenStreamRef.current) return;

        const screenTracks = screenStreamRef.current.getTracks();
        screenTracks.forEach(t => t.stop());
        screenStreamRef.current = null;

        Object.values(peerConnections.current).forEach(pc => {
            const senders = pc.getSenders();
            senders.forEach(s => {
                if (s.track && screenTracks.includes(s.track)) {
                    try {
                        pc.removeTrack(s);
                    } catch (e) {
                        console.error("Error removing track:", e);
                    }
                }
            });
        });

        // Detect if we need to restore audio (if it was somehow lost/replaced)
        // But with removeTrack, we just removed the extra senders.
        // We still need to verify the primary audio sender exists.
        const promises = Object.entries(peerConnections.current).map(async ([targetUuid, pc]) => {
            const senders = pc.getSenders();
            const hasAudio = senders.some(s => s.track && s.track.kind === 'audio' && s.track.readyState === 'live');

            if (!hasAudio && localStream.current) {
                // Re-add mic track if missing
                const micTrack = localStream.current.getAudioTracks()[0];
                if (micTrack) {
                    // Check if there is an empty audio sender we can reuse?
                    // Or just addTrack
                    pc.addTrack(micTrack, localStream.current);
                }
            }

            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                sendSignal({ type: 'offer', sdp: offer, target: targetUuid });
            } catch (e) { console.error("Renegotiation error:", e); }
        });
        await Promise.all(promises);

        setIsScreenSharing(false);
        setVoiceStates(prev => ({
            ...prev,
            [uuid.current]: { isMuted, isDeafened, isScreenSharing: false }
        }));
        sendSignal({ type: 'user_state', is_muted: isMuted, is_deafened: isDeafened, is_screen_sharing: false });
    }

    return {
        // State
        activeVoiceChannel,
        connectedUsers,
        speakingUsers,
        voiceStates,
        isMuted,
        isDeafened,
        isScreenSharing,
        remoteStreams,
        setConnectedUsers,
        setVoiceStates,
        setSpeakingUsers,
        setRemoteStreams,

        // Actions
        connectToRoom,
        disconnectVoice,
        toggleMute,
        toggleDeafen,
        handleOffer,
        createPC,
        startMeshConnection,
        startScreenShare,
        stopScreenShare,

        // Refs (if needed directly)
        peerConnections,
        remoteAudioRefs,
        screenStreamRef,

        // Noise Cancellation
        isNoiseCancelled,
        toggleNoiseCancellation: async () => {
            const newState = !isNoiseCancelled;
            setIsNoiseCancelled(newState);

            if (newState && localStream.current) {
                // Enable: Create noise suppression and replace tracks
                try {
                    const ns = new NoiseSuppression();
                    const processed = await ns.init(localStream.current);
                    if (processed && processed !== localStream.current) {
                        noiseSuppressionRef.current = ns;
                        processedStreamRef.current = processed;

                        // Replace audio track in all peer connections
                        const newTrack = processed.getAudioTracks()[0];
                        if (newTrack) {
                            Object.values(peerConnections.current).forEach(pc => {
                                const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
                                if (sender) sender.replaceTrack(newTrack);
                            });
                        }
                        toast.success('AI Gürültü Engelleme açıldı');
                    }
                } catch (e) {
                    console.error('[useWebRTC] Failed to enable noise suppression:', e);
                    setIsNoiseCancelled(false);
                    toast.error('Gürültü engelleme başlatılamadı');
                }
            } else {
                // Disable: Destroy noise suppression and restore raw track
                if (noiseSuppressionRef.current) {
                    noiseSuppressionRef.current.destroy();
                    noiseSuppressionRef.current = null;
                    processedStreamRef.current = null;
                }

                // Restore original mic track in all peer connections
                if (localStream.current) {
                    const rawTrack = localStream.current.getAudioTracks()[0];
                    if (rawTrack) {
                        Object.values(peerConnections.current).forEach(pc => {
                            const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
                            if (sender) sender.replaceTrack(rawTrack);
                        });
                    }
                }
                toast.success('AI Gürültü Engelleme kapatıldı');
            }
        }
    };
}
