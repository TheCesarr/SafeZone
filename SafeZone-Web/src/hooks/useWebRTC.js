import { useRef, useState, useEffect } from 'react';
import { getUrl, STUN_SERVERS } from '../utils/api';
import SoundManager from '../utils/SoundManager';
import toast from '../utils/toast';
import { NoiseSuppression } from '../audio/NoiseSuppression';

export const useWebRTC = (authState, uuid, roomWs, onMessageReceived, selectedInputId, selectedOutputId, audioSettings) => {
    // Media & Connection Refs
    const localStream = useRef(null);
    const peerConnections = useRef({}); // { [uuid]: RTCPeerConnection }
    const remoteAudioRefs = useRef({}); // { [uuid]: [Audio, Audio] } -> Array of audio elements (Mic, ScreenAudio)
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

    // SEPARATE STREAMS
    const [remoteStreams, setRemoteStreams] = useState({}); // { [uuid]: MediaStream } (Camera)
    const [remoteScreenStreams, setRemoteScreenStreams] = useState({}); // { [uuid]: MediaStream } (Screen)

    const [connectedUsers, setConnectedUsers] = useState([]);
    const [speakingUsers, setSpeakingUsers] = useState(new Set());

    // Voice States Map { [uuid]: { isMuted, isDeafened, isScreenSharing } }
    const [voiceStates, setVoiceStates] = useState({});

    // Helper: Send Signal via WebSocket
    const sendSignal = (data) => {
        if (roomWs.current?.readyState === WebSocket.OPEN) {
            const userId = authState.user?.username || uuid.current;
            roomWs.current.send(JSON.stringify({ ...data, uuid: userId }));
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
            if (onMessageReceived) onMessageReceived(msg);
        } else if (msg.type === 'user_state') {
            setVoiceStates(prev => ({
                ...prev,
                [msg.uuid]: { isMuted: msg.is_muted, isDeafened: msg.is_deafened, isScreenSharing: msg.is_screen_sharing }
            }));
            // If user stopped screen sharing, remove their screen stream
            if (msg.is_screen_sharing === false) {
                setRemoteScreenStreams(prev => {
                    const next = { ...prev };
                    delete next[msg.uuid];
                    return next;
                });
            }
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

        if (activeVoiceChannel && channel.type === 'voice' && activeVoiceChannel.id !== channel.id) {
            disconnectVoice();
        }

        if (channel.type === 'voice') {
            await startVoiceMedia(channel);
        }

        if (connectingRef.current !== channel.id) return;

        const userId = authState.user?.username || uuid.current;
        const wsUrl = getUrl(`/ws/room/${channel.id}/${userId}`, 'ws');
        roomWs.current = new WebSocket(wsUrl);

        setVoiceStates({});

        roomWs.current.onopen = () => {
            if (channel.type === 'voice') {
                sendSignal({ type: 'user_state', is_muted: isMuted, is_deafened: isDeafened, is_screen_sharing: isScreenSharing });
            }
        }

        roomWs.current.onmessage = handleVoiceMessage;
    }

    const startVoiceMedia = async (channel) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedInputId && selectedInputId !== 'default' ? { exact: selectedInputId } : undefined,
                    echoCancellation: audioSettings?.echoCancellation ?? true,
                    noiseSuppression: audioSettings?.noiseSuppression ?? true,
                    autoGainControl: audioSettings?.autoGainControl ?? true
                },
                video: false // Initial connection is AUDIO ONLY. Video/Screen added later.
            })
            localStream.current = stream;
            setActiveVoiceChannel(channel);

            stream.getAudioTracks().forEach(t => t.enabled = !isMuted);

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
        Object.values(remoteAudioRefs.current).forEach(audioArray => {
            if (Array.isArray(audioArray)) {
                audioArray.forEach(el => {
                    el.srcObject = null;
                    el.pause();
                });
            }
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
        setRemoteScreenStreams({});
        setActiveVoiceChannel(null);
        setConnectedUsers([]);

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        analyserRef.current = null;
        setSpeakingUsers(new Set());
        SoundManager.playLeave();

        if (noiseSuppressionRef.current) {
            noiseSuppressionRef.current.destroy();
            noiseSuppressionRef.current = null;
            processedStreamRef.current = null;
        }
    }

    // --- WebRTC PEER HANDLING ---
    const createPC = (targetUuid) => {
        const pc = new RTCPeerConnection(STUN_SERVERS);

        // Add Local MIC
        if (localStream.current) {
            const audioStream = processedStreamRef.current || localStream.current;
            audioStream.getAudioTracks().forEach(track => pc.addTrack(track, audioStream));
        }

        // Add Local SCREEN (if already sharing when new user joins)
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => pc.addTrack(track, screenStreamRef.current));
        }

        pc.ontrack = (event) => {
            const stream = event.streams[0];
            const track = event.track;

            // Distinguish content based on Video tracks? 
            // Better: use 'stream.id' to allow multiple streams per user.
            // But we need to know WHICH type it is (Camera vs Screen). 
            // Currently, we assume if it has video, it's screen share (since we don't have camera feature yet).
            // Future-proofing: We'll separate by stream ID.

            if (track.kind === 'audio') {
                // Manage multiple audio elements per user
                let audioArray = remoteAudioRefs.current[targetUuid] || [];

                // Check if we already have an element for this STREAM
                // (One stream might have multiple tracks, but usually passed as one object)
                const existingEl = audioArray.find(el => el.srcObject && el.srcObject.id === stream.id);

                if (!existingEl) {
                    const audioElement = new Audio();
                    audioElement.autoplay = true;
                    audioElement.volume = 1.0;
                    audioElement.muted = isDeafened; // Global Deafen
                    if (selectedOutputId && audioElement.setSinkId) {
                        audioElement.setSinkId(selectedOutputId).catch(console.error);
                    }
                    audioElement.srcObject = stream;
                    audioElement.play().catch(e => console.error("Play error", e));

                    audioArray.push(audioElement);
                    remoteAudioRefs.current[targetUuid] = audioArray;
                }
            } else if (track.kind === 'video') {
                // Determine if this is Screen Share or Camera
                // For now, in this app version, ANY video is Screen Share 
                // (unless we add Camera support later).
                // Let's assume all video is screen for now to fix the bug.
                // OR: We can check if existing audio stream is different.

                // FIX: Store specifically as ScreenShare for UI
                setRemoteScreenStreams(prev => ({ ...prev, [targetUuid]: stream }));

                // Also add to remoteStreams if we want to treat it generically? No, keep separate.
            }

            // Handle stream removal
            stream.onremovetrack = () => {
                // Check if tracks are empty
                if (stream.getTracks().length === 0) {
                    // Cleanup audio
                    let audioArray = remoteAudioRefs.current[targetUuid];
                    if (audioArray) {
                        const idx = audioArray.findIndex(el => el.srcObject?.id === stream.id);
                        if (idx !== -1) {
                            audioArray[idx].pause();
                            audioArray.splice(idx, 1);
                            remoteAudioRefs.current[targetUuid] = audioArray;
                        }
                    }

                    // Cleanup video
                    setRemoteScreenStreams(prev => {
                        if (prev[targetUuid]?.id === stream.id) {
                            const next = { ...prev };
                            delete next[targetUuid];
                            return next;
                        }
                        return prev;
                    });
                }
            };
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
                const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
                await pc.setLocalDescription(offer);
                sendSignal({ type: 'offer', sdp: offer, target: user.uuid });
            } catch (e) { }
        }
    }

    // --- DEVICE CHANGE EFFECTS ---
    useEffect(() => {
        if (activeVoiceChannel && localStream.current) {
            console.log("Switching Input Device to:", selectedInputId);
            // Stop old tracks (MIC only)
            localStream.current.getAudioTracks().forEach(t => t.stop());

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
                stream.getAudioTracks().forEach(t => t.enabled = !isMuted);

                // Replace tracks in PeerConnections
                Object.values(peerConnections.current).forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
                    if (sender) {
                        sender.replaceTrack(stream.getAudioTracks()[0]);
                    }
                });
                setupVoiceActivityDetection(stream);
            }).catch(e => console.error("Failed to switch input device", e));
        }
    }, [selectedInputId, audioSettings]);

    useEffect(() => {
        if (selectedOutputId) {
            Object.values(remoteAudioRefs.current).forEach(audioArray => {
                if (Array.isArray(audioArray)) {
                    audioArray.forEach(audio => {
                        if (audio.setSinkId) audio.setSinkId(selectedOutputId).catch(console.error);
                    });
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
            if (analyserRef.current) {
                // Reuse?
            } else {
                analyserRef.current = audioContext.createAnalyser();
                analyserRef.current.fftSize = 512;
                analyserRef.current.smoothingTimeConstant = 0.8;
            }
            const analyser = analyserRef.current;

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

        Object.values(remoteAudioRefs.current).forEach(audioArray => {
            if (Array.isArray(audioArray)) {
                audioArray.forEach(a => a.muted = newDeafened);
            }
        });

        if (localStream.current) {
            localStream.current.getAudioTracks().forEach(track => track.enabled = newDeafened ? false : !isMuted);
        }
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

            stream.getVideoTracks()[0].onended = () => stopScreenShare();

            const promises = Object.entries(peerConnections.current).map(async ([targetUuid, pc]) => {
                stream.getTracks().forEach(track => {
                    pc.addTrack(track, stream);
                });

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
                    try { pc.removeTrack(s); } catch (e) { }
                }
            });
            // Renegotiate removal
            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
                // We don't strictly need to send offer for removal in some cases, but good practice
            }).catch(console.error);
        });

        // Notify others
        const promises = Object.entries(peerConnections.current).map(async ([targetUuid, pc]) => {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal({ type: 'offer', sdp: offer, target: targetUuid });
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
        activeVoiceChannel,
        connectedUsers,
        speakingUsers,
        voiceStates,
        isMuted,
        isDeafened,
        isScreenSharing,
        remoteStreams,      // Camera Streams (Empty for now)
        remoteScreenStreams,// Screen Streams
        setConnectedUsers,
        setVoiceStates,
        setSpeakingUsers,
        setRemoteStreams,

        connectToRoom,
        disconnectVoice,
        toggleMute,
        toggleDeafen,
        handleOffer,
        createPC,
        startMeshConnection,
        startScreenShare,
        stopScreenShare,

        peerConnections,
        remoteAudioRefs,
        screenStreamRef,

        isNoiseCancelled,
        toggleNoiseCancellation: async () => { /* ... existing noise calc logic ... */ }
    };
}

