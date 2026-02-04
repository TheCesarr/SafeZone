import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid';
import ServerSidebar from './components/ServerSidebar';
import { getUrl, STUN_SERVERS } from './utils/api';
import LinkPreview from './components/LinkPreview';
import SoundManager from './utils/SoundManager';
import UserFooter from './components/UserFooter';
import ChatArea from './components/ChatArea';
import ChannelList from './components/ChannelList';
import VoiceRoom from './components/VoiceRoom';
import FriendsDashboard from './components/FriendsDashboard';
import RoleSettings from './components/RoleSettings';





function App() {
  // CONFIG STATE
  const [serverIp, setServerIp] = useState(localStorage.getItem('safezone_server_ip') || window.location.hostname || 'localhost')
  const [isServerSet, setIsServerSet] = useState(false)

  // AUTH STATE
  const [authState, setAuthState] = useState({ token: localStorage.getItem('safezone_token'), user: null, loaded: false })
  const [authMode, setAuthMode] = useState('login')
  const [authInput, setAuthInput] = useState({ username: '', password: '', display_name: '', recovery_pin: '', new_password: '' })
  const [authError, setAuthError] = useState(null)
  const [authSuccess, setAuthSuccess] = useState(null)

  // DATA STATE (Servers/Channels)
  const [myServers, setMyServers] = useState([])
  const [selectedServer, setSelectedServer] = useState(null)
  const selectedServerRef = useRef(null)

  // VIEW STATE (What the user is LOOKING at)
  const [selectedChannel, setSelectedChannel] = useState(null)

  // VOICE STATE (What the user is LISTENING/SPEAKING in)
  const [activeVoiceChannel, setActiveVoiceChannel] = useState(null)

  // MEMBER LIST & PRESENCE
  const [serverMembers, setServerMembers] = useState([])
  const [onlineUserIds, setOnlineUserIds] = useState([]) // From Lobby
  const [roomDetails, setRoomDetails] = useState({}) // { channelId: [uuid, uuid] }

  // MODAL STATE
  const [showCreateServer, setShowCreateServer] = useState(false)
  const [showJoinServer, setShowJoinServer] = useState(false)
  const [modalInput, setModalInput] = useState("")

  // DM STATE
  const [selectedDM, setSelectedDM] = useState(null); // { username, ... }
  const [dmHistory, setDmHistory] = useState([]); // [{ sender, content, timestamp }]

  // CHANNEL MANAGEMENT STATE
  const [showChannelCreateModal, setShowChannelCreateModal] = useState(false)
  const [showChannelRenameModal, setShowChannelRenameModal] = useState(false)
  const [channelToRename, setChannelToRename] = useState(null)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelType, setNewChannelType] = useState('text')

  // APP STATE (Chat & Users)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState("")
  const [attachment, setAttachment] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)

  // MESSAGE EDITING & CONTEXT MENU
  const [messageContextMenu, setMessageContextMenu] = useState(null) // { x, y, msg }
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editText, setEditText] = useState("")

  // TYPING INDICATOR
  const [typingUsers, setTypingUsers] = useState(new Set())
  const lastTypingTimeRef = useRef(0)

  const [connectedUsers, setConnectedUsers] = useState([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [ping, setPing] = useState(null)

  const roomWs = useRef(null)
  const lobbyWs = useRef(null)
  const chatWs = useRef(null) // Separate WS for text channels
  const localStream = useRef(null)

  // MESH NETWORK REFS
  const peerConnections = useRef({})
  const remoteAudioRefs = useRef({})
  const activeUsersRef = useRef([])
  const [remoteStreams, setRemoteStreams] = useState({}) // { [uuid]: MediaStream }
  const screenStreamRef = useRef(null)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  const uuid = useRef(localStorage.getItem('safezone_uuid') || Math.floor(Math.random() * 1000).toString())

  // AUDIO STATE
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [isNoiseCancelled, setIsNoiseCancelled] = useState(localStorage.getItem('safezone_noise_cancel') === 'true')
  const [userVolumes, setUserVolumes] = useState({})
  const [voiceStates, setVoiceStates] = useState({}) // { [uuid]: { isMuted: bool, isDeafened: bool } }
  const [speakingUsers, setSpeakingUsers] = useState(new Set()) // Set of UUIDs currently speaking

  // Audio Analysis
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)

  // RESIZABLE PANEL STATE
  const [channelListWidth, setChannelListWidth] = useState(240)
  const [memberListWidth, setMemberListWidth] = useState(240)
  const [isResizing, setIsResizing] = useState(null) // null | 'channel' | 'member'
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)

  // CONTEXT MENU STATE
  const [contextMenu, setContextMenu] = useState(null) // { x, y, serverId }

  // SETTINGS STATE
  const [showSettings, setShowSettings] = useState(false)
  const [showServerSettings, setShowServerSettings] = useState(false)
  const [activeSettingsTab, setActiveSettingsTab] = useState('profile')
  const [theme, setTheme] = useState(localStorage.getItem('safezone_theme') || 'dark')
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editAvatarColor, setEditAvatarColor] = useState('#5865F2')

  const [serverRoles, setServerRoles] = useState([]); // Roles for Context Menu
  const [userContextMenu, setUserContextMenu] = useState(null); // { x, y, user }

  const [inputDevices, setInputDevices] = useState([])
  const [outputDevices, setOutputDevices] = useState([])
  const [selectedInputId, setSelectedInputId] = useState('default')
  const [selectedOutputId, setSelectedOutputId] = useState('default')

  // FRIENDS STATE
  const [friends, setFriends] = useState([])
  const [friendRequests, setFriendRequests] = useState([]) // Pending incoming requests
  const [showFriendsList, setShowFriendsList] = useState(false)
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [friendInput, setFriendInput] = useState("")



  // --- ROLE CONTEXT MENU HANDLERS ---
  const handleUserContextMenu = (e, user) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent other menus
    setUserContextMenu({ x: e.clientX, y: e.clientY, user });
  }

  const handleToggleRole = async (roleId, targetUser) => {
    if (!selectedServer) return;
    const hasRole = targetUser.roles && targetUser.roles.includes(roleId);
    const endpoint = hasRole ? 'remove_role' : 'assign_role';

    try {
      const res = await fetch(getUrl(`/server/${selectedServer.id}/${endpoint}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: authState.token,
          user_id: targetUser.user_id,
          role_id: roleId
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchMembers(); // Refresh UI
        // Optionally close menu or keep it open? Discord keeps it open usually or closes?
        // Let's keep it open for multiple edits, or just close it. 
        // If I close it, it's annoying for multiple roles. check/uncheck logic usually keeps it open.
        // But I'm not re-rendering the menu efficiently if I don't close it?
        // Actually, fetchMembers updates serverMembers. userContextMenu.user refers to the OLD user object?
        // Hmm. userContextMenu.user is a reference. 
        // If serverMembers updates, that reference might be stale if I rely on it for 'roles' check in render.
        // I should prob pass the user ID and find the fresh user object in the render logic if possible.
        // Or simple solution: Close menu after toggle.
        // Let's NOT close it, but I need to handle the stale data issue.
        // In the render of the context menu, I should look up the user again from serverMembers.
      } else {
        alert(data.message);
      }
    } catch (e) { console.error(e); }
  }

  // --- STATUS CHANGE ---
  const handleStatusChange = (newStatus) => {
    // 1. Update local state immediately for UI response
    setAuthState(prev => ({
      ...prev,
      user: { ...prev.user, status: newStatus }
    }));

    // 2. Send update to Lobby WebSocket
    if (lobbyWs.current && lobbyWs.current.readyState === WebSocket.OPEN) {
      lobbyWs.current.send(JSON.stringify({
        type: 'status_update',
        status: newStatus
      }));
    }
  };

  // --- AUDIO HELPER FUNCTIONS ---
  const handleUserVolumeChange = (targetUuid, val) => {
    setUserVolumes(prev => ({ ...prev, [targetUuid]: val }));
    const audioEl = remoteAudioRefs.current[targetUuid];
    if (audioEl) audioEl.volume = val / 100;
  }

  const toggleMute = () => {
    if (isDeafened) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    SoundManager.playMute(newMuted);
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => { track.enabled = !newMuted; });
    }
    sendSignal({ type: 'user_state', is_muted: newMuted, is_deafened: isDeafened })
  }

  const toggleDeafen = () => {
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
    SoundManager.playDeafen(newDeafened);
    Object.values(remoteAudioRefs.current).forEach(audio => { if (audio) audio.muted = newDeafened; });
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => { track.enabled = newDeafened ? false : !isMuted; });
    }
    sendSignal({ type: 'user_state', is_muted: isMuted, is_deafened: newDeafened })
  }

  const toggleNoiseCancellation = async () => {
    const newState = !isNoiseCancelled;
    setIsNoiseCancelled(newState);
    localStorage.setItem('safezone_noise_cancel', newState);

    if (localStream.current) {
      const track = localStream.current.getAudioTracks()[0];
      if (track) {
        try {
          await track.applyConstraints({
            noiseSuppression: newState,
            echoCancellation: newState,
            autoGainControl: newState
          });
        } catch (e) {
          console.error("Constraint error", e);
        }
      }
    }
  }

  // --- RESIZE HANDLERS ---
  const handleResizeStart = (e, panel) => {
    e.preventDefault();
    setIsResizing(panel);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = panel === 'channel' ? channelListWidth : memberListWidth;
  }

  const handleResizeMove = (e) => {
    if (!isResizing) return;
    const delta = e.clientX - resizeStartX.current;

    let newWidth;
    if (isResizing === 'channel') {
      // Channel list: left-aligned
      // Increased min width to 180px to prevent text cut-off
      setChannelListWidth(Math.max(400, Math.min(600, resizeStartWidth.current + delta)));
    } else if (isResizing === 'member') {
      // Member list: right-aligned
      newWidth = Math.max(72, Math.min(500, resizeStartWidth.current - delta));
      setMemberListWidth(newWidth);
    }
  }

  const handleResizeEnd = () => {
    setIsResizing(null);
  }

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, channelListWidth, memberListWidth])

  // Sync ref with state
  useEffect(() => {
    selectedServerRef.current = selectedServer;
  }, [selectedServer]);



  // --- SERVER CONFIG ---
  const saveServerIp = () => {
    if (!serverIp || serverIp.trim() === '') {
      alert("Lütfen geçerli bir sunucu adresi girin (örn: localhost)");
      return;
    }
    let cleanIp = serverIp.replace(/https?:\/\//, '').replace(/\/$/, '');
    localStorage.setItem('safezone_server_ip', cleanIp)
    setServerIp(cleanIp)
    setIsServerSet(true)
    checkAuth(cleanIp)
  }

  // --- API HELPERS ---


  // --- DATA FETCHING ---
  const fetchServers = async () => {
    if (!authState.token) return [];
    try {
      const res = await fetch(`${getUrl('/server/list')}?token=${authState.token}`);
      const data = await res.json();
      if (data.status === 'success') {
        setMyServers(data.servers);

        // If a server is currently selected, find and update it with fresh data
        const currentSelected = selectedServerRef.current || selectedServer;

        if (currentSelected) {
          const updatedServer = data.servers.find(s => s.id === currentSelected.id);
          if (updatedServer) {
            setSelectedServer(updatedServer);

            // Also update selected channel if one is selected
            if (selectedChannel) {
              const updatedChannel = updatedServer.channels?.find(ch => ch.id === selectedChannel.id);
              if (updatedChannel) {
                setSelectedChannel(updatedChannel);
              }
            }
          }
        } else if (data.servers.length > 0) {
          // Only auto-select first server if no server is selected
          setSelectedServer(data.servers[0]);
        }

        return data.servers;
      }
    } catch (e) { console.error("Fetch servers error", e); }
    return [];
  }

  // Fetch Members & Select Default Channel
  // Data Fetching Helpers
  const fetchMembers = () => {
    if (selectedServer && authState.token) {
      fetch(`${getUrl(`/server/${selectedServer.id}/members`)}?token=${authState.token}`)
        .then(res => res.json())
        .then(data => { if (data.status === 'success') setServerMembers(data.members); })
        .catch(e => console.error("Members fetch error", e));

      // Also fetch roles
      fetch(`${getUrl(`/server/${selectedServer.id}/roles`)}`)
        .then(res => res.json())
        .then(data => { if (data.status === 'success') setServerRoles(data.roles); })
        .catch(e => console.error("Roles fetch error", e));
    }
  };

  useEffect(() => {
    if (selectedServer && authState.token) {
      fetchMembers();

      const interval = setInterval(fetchMembers, 10000); // Poll members every 10s

      // Only auto-select first channel if no channel is currently selected
      if (!selectedChannel && selectedServer.channels && selectedServer.channels.length > 0) {
        const firstTextChannel = selectedServer.channels.find(c => c.type === 'text') || selectedServer.channels[0];
        if (firstTextChannel) setSelectedChannel(firstTextChannel);
      }
      return () => clearInterval(interval);
    }
  }, [selectedServer, authState.token]);

  // Device Enumeration for Settings
  useEffect(() => {
    if (showSettings) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        setInputDevices(devices.filter(d => d.kind === 'audioinput'));
        setOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
      });
    }
  }, [showSettings]);

  const [userStatuses, setUserStatuses] = useState({}); // { [username]: 'online' | 'idle' | ... }

  // Connect to Lobby for Presence
  const connectToLobby = () => {
    if (lobbyWs.current) lobbyWs.current.close();
    const wsUrl = getUrl(`/ws/lobby/${uuid.current}`, 'ws');
    lobbyWs.current = new WebSocket(wsUrl);

    lobbyWs.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'lobby_update') {
          setTotalUsers(data.total_online);

          // Handle new object-based online_users
          const onlineUsersRaw = data.online_users || [];
          const ids = [];
          const statuses = {};

          if (onlineUsersRaw.length > 0 && typeof onlineUsersRaw[0] === 'object') {
            onlineUsersRaw.forEach(u => {
              if (u.status === 'invisible' && u.username !== uuid.current) {
                return;
              }
              ids.push(u.username);
              statuses[u.username] = u.status;
            });
          } else {
            // Fallback for string list (backward compatibility if needed)
            onlineUsersRaw.forEach(u => ids.push(u));
          }

          setOnlineUserIds(ids);
          setUserStatuses(prev => ({ ...prev, ...statuses }));
          setRoomDetails(data.room_details || {});
          // Refresh server list to get updated channels
          fetchServers();
        } else if (data.type === 'dm_received') {
          // Handle incoming DM
          if (selectedDM && selectedDM.username === data.sender) {
            setDmHistory(prev => [...prev, { sender: data.sender, content: data.content, timestamp: data.timestamp }]);
          } else {
            console.log("New DM from " + data.sender);
          }
        } else if (data.type === 'pong') {
          const latency = Date.now() - data.timestamp;
          setPing(latency);
        }
      } catch (e) { }
    };
  }

  // Join Lobby & Start Ping Loop
  useEffect(() => {
    if (isServerSet && authState.token) {
      connectToLobby();

      // Ping Loop
      const pingInterval = setInterval(() => {
        if (lobbyWs.current && lobbyWs.current.readyState === WebSocket.OPEN) {
          lobbyWs.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
      }, 5000); // Every 5s

      return () => clearInterval(pingInterval);
    }
  }, [isServerSet, authState.token]);


  const handleCreateServer = async () => {
    if (!modalInput) return;
    try {
      const res = await fetch(getUrl('/server/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authState.token, name: modalInput })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setShowCreateServer(false);
        setModalInput("");
        fetchServers();
      } else { alert(data.message); }
    } catch (e) { alert("Error: " + e.message); }
  }

  const handleJoinServer = async () => {
    if (!modalInput) return;
    try {
      const res = await fetch(getUrl('/server/join'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authState.token, invite_code: modalInput })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setShowJoinServer(false);
        setModalInput("");
        const servers = await fetchServers();
        const joinedServer = servers.find(s => s.id === data.server_id);
        if (joinedServer) {
          setSelectedServer(joinedServer);
          alert(`"${joinedServer.name}" sunucusuna katıldın!`);
        }
      } else { alert(data.message); }
    } catch (e) { alert("Error: " + e.message); }
  }

  const handleLeaveServer = async (serverId) => {
    if (!confirm('Bu sunucudan ayrılmak istediğine emin misin?')) return;
    try {
      const res = await fetch(getUrl(`/server/${serverId}/leave`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authState.token })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setContextMenu(null);
        if (selectedServer?.id === serverId) {
          setSelectedServer(null);
          setSelectedChannel(null);
          setShowFriendsList(true); // Switch to friends view instead of empty
        }
        fetchServers();
      } else { alert(data.message); }
    } catch (e) { alert("Error: " + e.message); }
  }

  const handleServerRightClick = (e, server) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, serverId: server.id });
  }

  // Close context menu on any click
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', closeMenu);
      return () => document.removeEventListener('click', closeMenu);
    }
  }, [contextMenu])

  // --- FRIEND FUNCTIONS ---
  const fetchFriends = async () => {
    if (!authState.token) return;
    try {
      const res = await fetch(getUrl('/friends/list'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authState.token })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setFriends(data.friends || []);
      }
    } catch (e) {
      console.error("Friends fetch error:", e);
    }
  };

  const fetchFriendRequests = async () => {
    if (!authState.token) return;
    try {
      const res = await fetch(getUrl('/friends/requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authState.token })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setFriendRequests(data.requests || []);
      }
    } catch (e) { }
  };

  const handleRespondRequest = async (senderUsername, action) => {
    try {
      const res = await fetch(getUrl('/friends/respond'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authState.token, sender_username: senderUsername, action })
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchFriendRequests();
        fetchFriends();
      } else alert(data.message);
    } catch (e) { alert("Error: " + e.message); }
  };

  const handleAddFriend = async () => {
    if (!friendInput) return;
    try {
      const res = await fetch(getUrl('/friends/add'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authState.token, friend_tag: friendInput })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setShowAddFriend(false);
        setFriendInput("");
        fetchFriends();
        alert(`${data.friend.username}#${data.friend.discriminator} arkadaş olarak eklendi!`);
      } else {
        alert(data.message);
      }
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const handleRemoveFriend = async (friendUsername) => {
    if (!confirm(`${friendUsername} arkadaşlarından kaldırılsın mı?`)) return;
    try {
      const res = await fetch(getUrl('/friends/remove'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authState.token, friend_username: friendUsername })
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchFriends();
      } else {
        alert(data.message);
      }
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  // Refresh friends list periodically (poll every 10s)
  useEffect(() => {
    if (authState.token) {
      const interval = setInterval(() => {
        fetchFriends();
        fetchFriendRequests();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [authState.token]);

  // Fetch friends when showing friends list
  useEffect(() => {
    if (showFriendsList && authState.token) {
      fetchFriends();
      fetchFriendRequests();
    }
  }, [showFriendsList, authState.token]);

  // --- AUTH LOGIC ---
  const checkAuth = async (ip = serverIp) => {
    const token = localStorage.getItem('safezone_token');
    if (!token) {
      setAuthState({ ...authState, loaded: true, token: null });
      return;
    }
    try {
      const res = await fetch(getUrl('/auth/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.status === 'success') {
        const userWithDisc = { ...data, discriminator: data.discriminator || '0001' };
        setAuthState({ token, user: userWithDisc, loaded: true });
        localStorage.setItem('safezone_uuid', data.username);
        uuid.current = data.username;
        fetchServers();
        fetchFriends(); // Initial friends fetch
      } else {
        setAuthState({ ...authState, loaded: true, token: null });
      }
    } catch (e) {
      setAuthError("Sunucuya bağlanılamadı.");
      setAuthState({ ...authState, loaded: true });
    }
  }

  useEffect(() => {
    if (isServerSet && authState.token) {
      fetchServers();
    }
  }, [isServerSet, authState.token]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) setContextMenu(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);


  const handleAuthSubmit = async () => {
    setAuthError(null);
    let endpoint = authMode === 'login' ? '/auth/login' : (authMode === 'register' ? '/auth/register' : '/auth/reset');

    try {
      const res = await fetch(getUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authInput)
      });
      const data = await res.json();

      if (data.status === 'success') {
        if (authMode === 'reset') {
          setAuthSuccess(data.message);
          setAuthMode('login');
          return;
        }
        localStorage.setItem('safezone_token', data.token);
        setAuthState({ token: data.token, user: data, loaded: true });
        uuid.current = data.username;
        localStorage.setItem('safezone_uuid', data.username);
        fetchServers();
      } else {
        setAuthError(data.message);
      }
    } catch (e) { setAuthError("Bağlantı hatası: " + e.message); }
  }

  const handleLogout = () => {
    if (!confirm('Hesaptan çıkış yapmak istediğine emin misin?')) return;
    localStorage.removeItem('safezone_token');
    localStorage.removeItem('safezone_uuid');
    setAuthState({ token: null, user: null, loaded: true });
    setMyServers([]);
    setSelectedServer(null);
    setSelectedChannel(null);
    setActiveVoiceChannel(null);
    setServerMembers([]);
    setFriends([]);
    setShowCreateServer(false);
    setShowJoinServer(false);
    setShowAddFriend(false);
    setShowFriendsList(false);
    setContextMenu(null);

    // Close connections
    if (roomWs.current) roomWs.current.close();
    if (lobbyWs.current) lobbyWs.current.close();
    if (localStream.current) {
      localStream.current.getTracks().forEach(t => t.stop());
      localStream.current = null;
    }
  }

  // --- DATA FETCHING & CHAT ---
  const fetchChannelMessages = async (channelId) => {
    if (!authState.token) return;
    try {
      const res = await fetch(`${getUrl(`/channel/${channelId}/messages`)}?token=${authState.token}`);
      const data = await res.json();
      if (data.status === 'success') {
        // RICH CHAT: Store objects directly, don't format as strings
        setMessages(data.messages);
      }
    } catch (e) {
      console.error("Fetch messages error:", e);
    }
  }

  const connectToChat = (channel) => {
    if (chatWs.current) {
      chatWs.current.close();
      chatWs.current = null;
    }

    const wsUrl = getUrl(`/ws/room/${channel.id}/${uuid.current}`, 'ws');
    chatWs.current = new WebSocket(wsUrl);

    chatWs.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'chat') {
          // Play sound if message is not from self
          if (msg.sender !== authState.user.username) {
            SoundManager.playMessage();
          }
          // RICH CHAT: Receive formatted object
          setMessages(prev => [...prev, {
            sender: msg.sender,
            text: msg.text,
            attachment_url: msg.attachment_url,
            attachment_type: msg.attachment_type,
            attachment_name: msg.attachment_name,
            timestamp: new Date().toISOString()
          }])
        } else if (msg.type === 'typing') {
          const sender = msg.sender;
          if (sender !== authState.user.username) {
            setTypingUsers(prev => {
              const newSet = new Set(prev);
              newSet.add(sender);
              return newSet;
            });

            setTimeout(() => {
              setTypingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(sender);
                return newSet;
              });
            }, 3000);
          }
        }
      } catch (e) { }
    };
  }

  // --- CHANNEL SELECTION EFFECT (Persistence & Connection) ---
  useEffect(() => {
    if (selectedChannel?.type === 'text') {
      // 1. Clear previous messages
      setMessages([]);

      // 2. Fetch History
      fetchChannelMessages(selectedChannel.id);

      // 3. Connect to Chat Socket (if not in voice, or dual mode)
      if (activeVoiceChannel) {
        connectToChat(selectedChannel);
      } else {
        connectToChat(selectedChannel);
        // Ensure roomWs is closed if just browsing text
        if (roomWs.current) {
          roomWs.current.close();
          roomWs.current = null;
        }
      }
    }
  }, [selectedChannel]); // Re-run when channel changes

  // --- CHANNEL NAVIGATION & VOICE LOGIC ---
  const handleChannelClick = (channel) => {
    // 1. Just Switch View (useEffect will handle Text logic)
    setSelectedChannel(channel);

    // 2. Voice Connection Logic (Must confirm explicit click)
    if (channel.type === 'voice') {
      // Connect main roomWs to voice (handles audio + signaling)
      connectToRoom(channel);

      // Close separate chatWs if it exists
      if (chatWs.current) {
        chatWs.current.close();
        chatWs.current = null;
      }
    }
  }

  // --- CHANNEL MANAGEMENT FUNCTIONS ---
  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;

    try {
      const res = await fetch(getUrl('/channel/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: authState.token,
          server_id: selectedServer.id,
          channel_name: newChannelName.trim(),
          channel_type: newChannelType
        })
      });

      const data = await res.json();
      if (data.status === 'success') {
        setNewChannelName('');
        setNewChannelType('text');
        setShowChannelCreateModal(false);
        // Refresh server list to get updated channels
        fetchServers();
      } else {
        alert('Kanal oluşturma hatası: ' + data.message);
      }
    } catch (err) {
      console.error('Create channel error:', err);
      alert('Kanal oluşturulamadı!');
    }
  };

  const handleRenameChannel = async () => {
    if (!newChannelName.trim() || !channelToRename) return;

    try {
      const res = await fetch(getUrl('/channel/rename'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: authState.token,
          channel_id: channelToRename.id,
          new_name: newChannelName.trim()
        })
      });

      const data = await res.json();
      if (data.status === 'success') {
        setNewChannelName('');
        setChannelToRename(null);
        setShowChannelRenameModal(false);
        fetchServers();
      } else {
        alert('İsim değiştirme hatası: ' + data.message);
      }
    } catch (err) {
      console.error('Rename channel error:', err);
      alert('İsim değiştirilemedi!');
    }
  };

  const handleDeleteChannel = async (channel) => {
    if (!confirm(`"${channel.name}" kanalını silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      const res = await fetch(getUrl('/channel/delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: authState.token,
          channel_id: channel.id
        })
      });

      const data = await res.json();
      if (data.status === 'success') {
        if (selectedChannel?.id === channel.id) {
          setSelectedChannel(null);
        }
        fetchServers();
      } else {
        alert('Silme hatası: ' + data.message);
      }
    } catch (err) {
      console.error('Delete channel error:', err);
      alert('Kanal silinemedi!');
    }
  };

  const openRenameModal = (channel) => {
    setChannelToRename(channel);
    setNewChannelName(channel.name);
    setShowChannelRenameModal(true);
  };

  const connectToRoom = async (channel) => {
    // If switching channels, close old WS
    if (roomWs.current) {
      roomWs.current.close();
      roomWs.current = null;
    }

    // Reset voice state only if switching to a DIFFERENT voice channel
    if (activeVoiceChannel && channel.type === 'voice' && activeVoiceChannel.id !== channel.id) {
      disconnectVoice();
    }

    const wsUrl = getUrl(`/ws/room/${channel.id}/${uuid.current}`, 'ws');
    roomWs.current = new WebSocket(wsUrl);

    /* Clear previous voice states when connecting to new room */
    setVoiceStates({});

    roomWs.current.onopen = () => {
      // If voice, send initial state
      if (channel.type === 'voice') {
        sendSignal({ type: 'user_state', is_muted: false, is_deafened: false });
      }
    }
    roomWs.current.onmessage = handleVoiceMessage;

    // If Voice, also get Media
    if (channel.type === 'voice') {
      startVoiceMedia(channel);
    }
  }

  const startVoiceMedia = async (channel) => {
    try {
      // Apply saved noise cancellation preference on start
      const savedNoise = localStorage.getItem('safezone_noise_cancel') === 'true';
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: savedNoise ? {
          // Advanced noise cancellation (Discord Krisp-like)
          noiseSuppression: { ideal: true },
          echoCancellation: { ideal: true },
          autoGainControl: { ideal: true },
          // Additional constraints for better noise filtering
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 },
          latency: { ideal: 0.01 }
        } : {
          // Basic audio without noise cancellation
          noiseSuppression: false,
          echoCancellation: false,
          autoGainControl: false
        },
        video: false
      })
      localStream.current = stream
      setActiveVoiceChannel(channel);
      setIsMuted(false);
      setIsDeafened(false);
      SoundManager.playJoin();

      // Setup voice activity detection
      setupVoiceActivityDetection(stream);
    } catch (e) {
      alert("Mikrofon izni gerekli.")
      return
    }
  }

  const setupVoiceActivityDetection = (stream) => {
    try {
      // Create audio context and analyser
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Connect microphone stream to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Monitor audio levels
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let isSpeaking = false;
      const SPEAKING_THRESHOLD = 30; // Adjust sensitivity (0-255)
      const SILENCE_THRESHOLD = 15;

      const checkAudioLevel = () => {
        if (!analyserRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;

        const shouldBeSpeaking = average > SPEAKING_THRESHOLD;

        // Only update if state changed (avoid unnecessary updates)
        if (shouldBeSpeaking && !isSpeaking) {
          isSpeaking = true;
          setSpeakingUsers(prev => new Set([...prev, uuid.current]));
          // Broadcast speaking state to others
          sendSignal({ type: 'speaking', is_speaking: true });
        } else if (!shouldBeSpeaking && isSpeaking && average < SILENCE_THRESHOLD) {
          isSpeaking = false;
          setSpeakingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(uuid.current);
            return newSet;
          });
          sendSignal({ type: 'speaking', is_speaking: false });
        }

        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (e) {
      console.error('Voice activity detection setup failed:', e);
    }
  }

  const disconnectVoice = () => {
    if (roomWs.current) roomWs.current.close();
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
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
    setIsScreenSharing(false);
    setActiveVoiceChannel(null);
    setConnectedUsers([]);
    activeUsersRef.current = [];

    // Cleanup voice activity detection
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;
    setSpeakingUsers(new Set());
    SoundManager.playLeave();
  }

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.onended = () => stopScreenShare();

      SoundManager.playScreenShare(true);

      // Update State & Broadcast
      setIsScreenSharing(true);
      sendSignal({ type: 'user_state', is_muted: isMuted, is_deafened: isDeafened, is_screen_sharing: true });

      // Add track to existing connections
      for (const [targetUuid, pc] of Object.entries(peerConnections.current)) {
        const sender = pc.addTrack(videoTrack, stream);
        // Renegotiate
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal({ type: 'offer', sdp: offer, target: targetUuid });
      }
    } catch (e) {
      console.error("Screen share error", e);
      alert("Ekran paylaşımı hatası: " + e.message + "\n(İptal etmiş veya izin vermemiş olabilirsiniz.)");
    }
  }

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
    setRemoteStreams({});
    SoundManager.playScreenShare(false); // Play Stop Sound
    sendSignal({ type: 'user_state', is_muted: isMuted, is_deafened: isDeafened, is_screen_sharing: false });

    // Remove video sender from PCs
    // Note: Proper renegotiation needed to remove track cleanly, but usually just stopping track works for simple cases.
    // For robustness, we should renegotiate.
    // Actually, simply stopping the track will show black/frozen frame on remote. 
    // Ideally we removeSender and renegotiate.
    // Simplifying for MVP: just stop generic track.

    // Better: Re-create connections or use removeTrack?
    // Let's implement full renegotiation for cleanly removing.
    for (const [targetUuid, pc] of Object.entries(peerConnections.current)) {
      const senders = pc.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      if (videoSender) {
        pc.removeTrack(videoSender);
        pc.createOffer().then(offer => {
          pc.setLocalDescription(offer);
          sendSignal({ type: 'offer', sdp: offer, target: targetUuid });
        });
      }
    }
  }

  const handleVoiceMessage = async (event) => {
    const msg = JSON.parse(event.data)
    if (msg.target && msg.target !== uuid.current) return;

    if (msg.type === 'user_list') {
      setConnectedUsers(msg.users); activeUsersRef.current = msg.users;
      // Sync voice states from user list
      const states = {};
      msg.users.forEach(u => {
        states[u.uuid] = { isMuted: u.is_muted, isDeafened: u.is_deafened, isScreenSharing: u.is_screen_sharing };
      });
      setVoiceStates(prev => ({ ...prev, ...states }));
    } else if (msg.type === 'chat') {
      setMessages(prev => [...prev, `${msg.sender}: ${msg.text}`])
    } else if (msg.type === 'history') {
      const history = msg.messages.map(m => `${m.sender}: ${m.text}`);
      setMessages(history);
    } else if (msg.type === 'user_state') {
      // Update mute/deafen icon for a user (in roomDetails or separate state)
      // For now, let's update roomDetails indirectly via lobby update or local handle? 
      // Actually 'user_state' should be broadcasted. 
      // We can store it in a new state or update roomDetails if we had it here.
      // Let's rely on Lobby Update for the list, but for realtime state, we need to track it.
      // Simplified: Force lobby update? Or tracking state locally.
      // Best way: Update userVolumes or similar state map for UI
      setRoomDetails(prev => {
        const channelId = selectedChannel?.id;
        if (!channelId) return prev;
        // We need a way to store "Muted" status. 
        // Let's assume Lobby handles it? No.
        // We'll add a 'voiceStates' state to App.
        return prev;
      });
      // Actually, let's add `voiceStates` state map { [uuid]: { muted: bool, deafened: bool } }
      setVoiceStates(prev => ({
        ...prev,
        [msg.uuid]: { isMuted: msg.is_muted, isDeafened: msg.is_deafened, isScreenSharing: msg.is_screen_sharing }
      }));
    } else if (msg.type === 'speaking') {
      // Handle remote user speaking state
      if (msg.is_speaking) {
        setSpeakingUsers(prev => new Set([...prev, msg.uuid]));
      } else {
        setSpeakingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(msg.uuid);
          return newSet;
        });
      }
    } else if (msg.type === 'system' && msg.action === 'please_offer') {
      startMeshConnection();
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

  const startMeshConnection = async () => {
    const currentActiveUsers = activeUsersRef.current;
    for (const user of currentActiveUsers) {
      if (user.uuid === uuid.current) continue;
      if (peerConnections.current[user.uuid]) continue;

      const pc = createPC(user.uuid);
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        sendSignal({ type: 'offer', sdp: offer, target: user.uuid });
      } catch (e) { }
    }
  };

  const createPC = (targetUuid) => {
    const pc = new RTCPeerConnection(STUN_SERVERS);
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => pc.addTrack(track, localStream.current));
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

  const sendSignal = (data) => {
    if (roomWs.current?.readyState === WebSocket.OPEN) {
      roomWs.current.send(JSON.stringify({ ...data, uuid: uuid.current }));
    }
  }

  // --- FILE UPLOAD HANDLER ---
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('token', authState.token);
    formData.append('file', file);

    try {
      const res = await fetch(getUrl('/chat/upload'), { method: 'POST', body: formData });
      const data = await res.json();
      if (data.status === 'success') {
        setAttachment(data); // { url, type, name }
      } else {
        alert("Yükleme başarısız: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Dosya yükleme hatası!");
    } finally {
      setIsUploading(false);
    }
  }

  const handleTyping = (e) => {
    setInputText(e.target.value);

    const now = Date.now();
    if (now - lastTypingTimeRef.current > 2000) {
      const msg = { type: 'typing', sender: authState.user.username };
      if (chatWs.current?.readyState === WebSocket.OPEN) chatWs.current.send(JSON.stringify(msg));
      else if (roomWs.current?.readyState === WebSocket.OPEN) roomWs.current.send(JSON.stringify(msg));
      lastTypingTimeRef.current = now;
    }
  }

  const sendChatMessage = () => {
    if (!inputText && !attachment) return
    const msg = {
      type: 'chat',
      text: inputText,
      sender: authState.user.username,
      uuid: uuid.current,
      attachment_url: attachment?.url,
      attachment_type: attachment?.type,
      attachment_name: attachment?.name
    }

    if (chatWs.current && chatWs.current.readyState === WebSocket.OPEN) {
      chatWs.current.send(JSON.stringify(msg))
    } else if (roomWs.current && roomWs.current.readyState === WebSocket.OPEN) {
      roomWs.current.send(JSON.stringify(msg))
    }

    // Optimistic Local Update (Object format)
    setMessages(prev => [...prev, {
      sender: authState.user.username,
      text: inputText,
      attachment_url: attachment?.url,
      attachment_type: attachment?.type,
      attachment_name: attachment?.name,
      timestamp: new Date().toISOString()
    }])


    setInputText("")
    setAttachment(null)
  }

  // --- MESSAGE CONTEXT MENU & EDITING ---
  useEffect(() => {
    const closeMenu = () => setMessageContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleMessageContextMenu = (e, msg) => {
    if (msg.sender !== authState.user.username) return; // Only own messages
    e.preventDefault();
    setMessageContextMenu({ x: e.pageX, y: e.pageY, msg });
  }

  const handleDeleteMessage = async () => {
    if (!messageContextMenu) return;
    const msgId = messageContextMenu.msg.id;
    if (!msgId) return;

    try {
      await fetch(getUrl('/message/delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authState.token, message_id: msgId })
      });
      // Optimistic delete
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (e) { console.error(e); }
  }

  const startEditing = () => {
    setEditingMessageId(messageContextMenu.msg.id);
    setEditText(messageContextMenu.msg.content || messageContextMenu.msg.text || "");
  }

  const submitEdit = async () => {
    try {
      await fetch(getUrl('/message/edit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: authState.token, message_id: editingMessageId, content: editText })
      });
      // Optimistic update
      setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, content: editText, text: editText, edited_at: new Date().toISOString() } : m));
      setEditingMessageId(null);
    } catch (e) { console.error(e); }
  }

  // --- DM LOGIC ---
  const handleStartDM = (friend) => {
    setSelectedDM(friend);
    setSelectedServer(null); // Switch view to Friend/DM
    setSelectedChannel(null);
    // Fetch History
    fetch(getUrl('/dm/history'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: authState.token, username: friend.username })
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') setDmHistory(data.messages);
      });
  }

  const sendDM = () => {
    if (!inputText.trim() || !selectedDM) return;
    const text = inputText;
    setInputText("");

    // Optimistic Update
    setDmHistory(prev => [...prev, { sender: authState.user.username, content: text, timestamp: new Date().toISOString() }]);

    fetch(getUrl('/dm/send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: authState.token, receiver_username: selectedDM.username, content: text })
    });
  }

  // --- RENDER HELPERS ---


  // --- RENDER MAIN ---
  if (!isServerSet) { /* ... */ return (
    <div style={{ backgroundColor: '#121212', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '400px', padding: '40px', background: '#1e1e1e', borderRadius: '16px', textAlign: 'center' }}>
        <h2>Sunucu Bağlantısı</h2>
        <input type="text" placeholder="IP Adresi" value={serverIp} onChange={e => setServerIp(e.target.value)}
          style={{ width: '100%', padding: '15px', margin: '20px 0', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '8px', WebkitAppRegion: 'no-drag', cursor: 'text' }} />
        <button onClick={saveServerIp} style={{ width: '100%', padding: '15px', background: '#007AFF', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', WebkitAppRegion: 'no-drag' }}>Bağlan</button>
      </div>
    </div>
  )
  }
  if (!authState.token) { /* ... */ return (
    <div style={{ backgroundColor: '#121212', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '400px', padding: '40px', background: '#1e1e1e', borderRadius: '16px', textAlign: 'center' }}>
        <h2>SafeZone Giriş</h2>
        {authError && <div style={{ color: 'red', marginBottom: '10px' }}>{authError}</div>}

        <input type="text" placeholder="Kullanıcı Adı" value={authInput.username} onChange={e => setAuthInput({ ...authInput, username: e.target.value })} style={{ width: '100%', padding: '15px', margin: '10px 0', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '8px', WebkitAppRegion: 'no-drag', cursor: 'text' }} />

        {authMode === 'register' && (
          <>
            <input type="text" placeholder="Görünen Ad" value={authInput.display_name} onChange={e => setAuthInput({ ...authInput, display_name: e.target.value })} style={{ width: '100%', padding: '15px', margin: '10px 0', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '8px', WebkitAppRegion: 'no-drag', cursor: 'text' }} />
            <input type="text" placeholder="Kurtarma PIN (4 haneli)" value={authInput.recovery_pin} onChange={e => setAuthInput({ ...authInput, recovery_pin: e.target.value })} style={{ width: '100%', padding: '15px', margin: '10px 0', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '8px', WebkitAppRegion: 'no-drag', cursor: 'text' }} />
          </>
        )}

        {(authMode === 'login' || authMode === 'register' || authMode === 'reset') && (
          <input type="password" placeholder={authMode === 'reset' ? "Yeni Şifre" : "Şifre"} value={authInput.password} onChange={e => setAuthInput({ ...authInput, password: e.target.value })} style={{ width: '100%', padding: '15px', margin: '10px 0', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '8px', WebkitAppRegion: 'no-drag', cursor: 'text' }} />
        )}

        {authMode === 'reset' && (
          <input type="text" placeholder="Kurtarma PIN (4 haneli)" value={authInput.recovery_pin} onChange={e => setAuthInput({ ...authInput, recovery_pin: e.target.value })} style={{ width: '100%', padding: '15px', margin: '10px 0', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '8px', WebkitAppRegion: 'no-drag', cursor: 'text' }} />
        )}

        <button onClick={handleAuthSubmit} style={{ width: '100%', padding: '15px', background: '#34C759', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '10px', WebkitAppRegion: 'no-drag' }}>
          {authMode === 'login' ? 'Giriş Yap' : (authMode === 'register' ? 'Kayıt Ol' : 'Şifreyi Sıfırla')}
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '12px', color: '#888' }}>
          <span style={{ cursor: 'pointer', WebkitAppRegion: 'no-drag' }} onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
            {authMode === 'login' ? 'Hesap Oluştur' : 'Giriş Yap'}
          </span>
          {authMode === 'login' && (
            <span style={{ cursor: 'pointer', color: '#007AFF', WebkitAppRegion: 'no-drag' }} onClick={() => setAuthMode('reset')}>
              Şifremi Unuttum
            </span>
          )}
        </div>
      </div>
    </div>
  )
  }

  // 3. MAIN APP LAYOUT (4 Columns)
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      width: '100vw',
      height: '100vh',
      backgroundColor: theme === 'dark' ? '#0f0f0f' : '#f0f0f0',
      background: theme === 'dark'
        ? 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)'
        : 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
      color: theme === 'dark' ? 'white' : 'black',
      fontFamily: '"Inter", sans-serif',
      overflow: 'hidden'
    }}>
      {/* COL 1: SERVER LIST */}
      {/* COL 1: SERVER LIST (Refactored) */}
      <ServerSidebar
        myServers={myServers}
        selectedServer={selectedServer}
        showFriendsList={showFriendsList}
        onServerClick={(s) => { setSelectedServer(s); setSelectedChannel(null); setShowFriendsList(false); setSelectedDM(null); }}
        onFriendsClick={() => { setShowFriendsList(true); setSelectedServer(null); setSelectedChannel(null); setSelectedDM(null); }}
        onCreateServerClick={() => setShowCreateServer(true)}
        onJoinServerClick={() => setShowJoinServer(true)}
        onSettingsClick={() => setShowSettings(true)}
        handleServerRightClick={handleServerRightClick}
      />

      {/* COL 2: CHANNEL LIST / FRIENDS PANEL */}
      <ChannelList
        width={channelListWidth}
        showFriendsList={showFriendsList}
        friendRequests={friendRequests}
        friends={friends}
        onlineUserIds={onlineUserIds}
        userStatuses={userStatuses}
        handleRespondRequest={handleRespondRequest}
        setShowAddFriend={setShowAddFriend}
        handleStartDM={handleStartDM}
        handleRemoveFriend={handleRemoveFriend}
        selectedServer={selectedServer}
        serverMembers={serverMembers}
        setShowChannelCreateModal={setShowChannelCreateModal}
        handleChannelClick={handleChannelClick}
        setContextMenu={setContextMenu}
        selectedChannel={selectedChannel}
        activeVoiceChannel={activeVoiceChannel}
        roomDetails={roomDetails}
        speakingUsers={speakingUsers}
        voiceStates={voiceStates}
        authState={authState}
        isMuted={isMuted}
        isDeafened={isDeafened}
        isNoiseCancelled={isNoiseCancelled}
        isScreenSharing={isScreenSharing}
        ping={ping}
        onDisconnect={disconnectVoice}
        onToggleMute={toggleMute}
        onToggleDeafen={toggleDeafen}
        onToggleNoiseCancellation={toggleNoiseCancellation}
        onScreenShare={startScreenShare}
        stopScreenShare={stopScreenShare}
        onStatusChange={handleStatusChange}
        handleServerSettings={() => setShowServerSettings(true)}
      >

        {/* RESIZE HANDLE for Channel List */}
        <div
          onMouseDown={(e) => handleResizeStart(e, 'channel')}
          style={{
            position: 'absolute',
            top: 0,
            right: -2,
            width: '4px',
            height: '100%',
            cursor: 'ew-resize',
            backgroundColor: 'transparent',
            zIndex: 10,
            transition: isResizing === 'channel' ? 'none' : 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#007AFF'}
          onMouseLeave={(e) => isResizing !== 'channel' && (e.currentTarget.style.backgroundColor = 'transparent')}
        />
      </ChannelList>

      {/* COL 3: CHAT VIEW (Main) */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'transparent', order: 3 }}>
        {/* CHANNEL/DM HEADER */}
        <div style={{ padding: '15px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(22, 22, 22, 0.6)', backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>
              {selectedDM ? '@' : (selectedChannel?.type === 'voice' ? '🔊' : (selectedChannel ? '#' : '👋'))}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 'bold' }}>
                {selectedDM ? selectedDM.username : (selectedChannel ? selectedChannel.name : 'Hoşgeldin!')}
              </span>
              <span style={{ fontSize: '12px', color: '#888' }}>
                {selectedDM ? `DM: ${selectedDM.display_name}` : (selectedChannel ? selectedChannel.type.toUpperCase() : 'Sunucu seçimi yapın')}
              </span>
            </div>
          </div>
        </div>

        {/* CHAT AREA (Server OR DM) */}
        {(selectedChannel?.type === 'text' || selectedDM) ? (
          <ChatArea
            selectedChannel={selectedChannel}
            selectedDM={selectedDM}
            messages={messages}
            dmHistory={dmHistory}
            currentUser={authState.user}
            inputText={inputText}
            setInputText={setInputText}
            onSendMessage={sendChatMessage}
            onSendDM={sendDM}
            handleTyping={handleTyping}
            typingUsers={typingUsers}
            attachment={attachment}
            setAttachment={setAttachment}
            isUploading={isUploading}
            fileInputRef={fileInputRef}
            handleFileSelect={handleFileSelect}
            editingMessageId={editingMessageId}
            setEditingMessageId={setEditingMessageId}
            editText={editText}
            setEditText={setEditText}
            submitEdit={submitEdit}
            handleMessageContextMenu={handleMessageContextMenu}
          />
        ) : (
          selectedChannel?.type === 'voice' ? (
            <VoiceRoom
              selectedChannel={selectedChannel}
              remoteStreams={remoteStreams}
              activeUsersRef={activeUsersRef}
              isScreenSharing={isScreenSharing}
              screenStreamRef={screenStreamRef}
              connectedUsers={connectedUsers}
              voiceStates={voiceStates}
              handleUserVolumeChange={handleUserVolumeChange}
              userVolumes={userVolumes}
              activeVoiceChannel={activeVoiceChannel}
            />
          ) : (
            /* FRIENDS DASHBOARD (HOME VIEW) */
            <FriendsDashboard
              friends={friends}
              friendRequests={friendRequests}
              onlineUserIds={onlineUserIds}
              userStatuses={userStatuses}
              handleRespondRequest={handleRespondRequest}
              setShowAddFriend={setShowAddFriend}
              handleStartDM={handleStartDM}
              handleRemoveFriend={handleRemoveFriend}
              handleAddFriend={(tag) => { setFriendInput(tag); handleAddFriend(); }}
            />
          )
        )
        }
      </div >

      {/* COL 4: MEMBER LIST (Right) - RIGHTMOST COLUMN */}
      < div style={{ width: `${memberListWidth}px`, flexShrink: 0, overflowY: 'auto', background: 'rgba(22, 22, 22, 0.6)', backdropFilter: 'blur(20px) saturate(180%)', borderLeft: '1px solid rgba(255, 255, 255, 0.1)', padding: '20px', position: 'relative', order: 4 }}>

        {/* RESIZE HANDLE for Member List (on LEFT edge) */}
        < div
          onMouseDown={(e) => handleResizeStart(e, 'member')}
          style={{
            position: 'absolute',
            top: 0,
            left: -2,
            width: '4px',
            height: '100%',
            cursor: 'ew-resize',
            backgroundColor: 'transparent',
            zIndex: 10,
            transition: isResizing === 'member' ? 'none' : 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#007AFF'}
          onMouseLeave={(e) => isResizing !== 'member' && (e.currentTarget.style.backgroundColor = 'transparent')}
        />

        < h3 style={{ color: '#888', fontSize: '12px', textTransform: 'uppercase', marginBottom: '20px' }}>
          {showFriendsList ? 'ARKADAŞLAR' : selectedChannel && selectedChannel.type === 'voice' ? `SES ODASI` : `SUNUCU ÜYELERİ - ${serverMembers.length}`}
        </h3 >

        {
          showFriendsList ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} >
              {
                friends.length === 0 ? (
                  <div style={{ color: '#666', fontSize: '12px', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
                    Arkadaş listesi boş
                  </div>
                ) : (
                  friends.map(friend => (
                    <div key={friend.username} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px' }}>
                        {friend.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold', color: '#fff' }}>
                          {friend.display_name || friend.username}
                        </span>
                        <span style={{ fontSize: '10px', color: '#666' }}>@{friend.username}#{friend.discriminator}</span>
                      </div>
                    </div>
                  ))
                )
              }
            </div >
          ) : selectedChannel && selectedChannel.type === 'voice' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(roomDetails[selectedChannel.id] || []).map(uid => {
                const isMe = uid === uuid.current;
                const vol = userVolumes[uid] || 100;
                return (
                  <div key={uid} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {uid.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{uid}</span>
                        {/* Show mute/deafen icons */}
                        {(() => {
                          const state = isMe ? { isMuted, isDeafened } : (voiceStates[uid] || {});
                          return (state.isMuted || state.isDeafened) && (
                            <div style={{ display: 'flex', gap: '2px', marginLeft: '2px' }}>
                              {state.isMuted && <span style={{ fontSize: '12px', filter: 'brightness(0) saturate(100%) invert(38%) sepia(77%) saturate(3430%) hue-rotate(343deg) brightness(99%) contrast(95%)' }} title="Muted">🎙️</span>}
                              {state.isDeafened && <span style={{ fontSize: '12px', filter: 'brightness(0) saturate(100%) invert(38%) sepia(77%) saturate(3430%) hue-rotate(343deg) brightness(99%) contrast(95%)' }} title="Deafened">🎧</span>}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                    {!isMe && activeVoiceChannel?.id === selectedChannel.id && (
                      <input type="range" min="0" max="100" value={vol} onChange={(e) => handleUserVolumeChange(uid, e.target.value)}
                        style={{ width: '100%', height: '4px', marginLeft: '5px' }} title="Ses Seviyesi" />
                    )}
                  </div>
                )
              })}
              {(roomDetails[selectedChannel.id] || []).length === 0 && (
                <div style={{ color: '#666', fontSize: '12px', fontStyle: 'italic' }}>Kimse yok...</div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(() => {
                const online = [];
                const offline = [];
                serverMembers.forEach(m => {
                  const isOnline = onlineUserIds.includes(m.username);
                  if (isOnline) online.push(m);
                  else offline.push(m);
                });

                const groups = {};
                online.forEach(m => {
                  // Try highest_role, fallback to 'Member' with default color
                  const role = m.highest_role || { name: 'Üye', color: '#99AAB5', position: 0 };
                  if (!groups[role.name]) groups[role.name] = { ...role, members: [] };
                  groups[role.name].members.push(m);
                });

                // Sort groups by position DESC
                const sortedGroups = Object.values(groups).sort((a, b) => b.position - a.position);

                return (
                  <>
                    {sortedGroups.map(g => (
                      <div key={g.name}>
                        <div style={{ color: '#96989d', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px', marginTop: '10px' }}>
                          {g.name} — {g.members.length}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {g.members.map(m => {
                            const isMe = m.username === authState.user.username;
                            const status = userStatuses[m.username] || 'online';
                            // Status Colors: Online(Green), Idle(Yellow), DND(Red), Invisible(Gray)
                            const statusColor = status === 'online' ? '#3ba55c' : (status === 'idle' ? '#faa61a' : (status === 'dnd' ? '#ed4245' : '#747f8d'));

                            return (
                              <div key={m.username} onContextMenu={(e) => handleUserContextMenu(e, m)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', transition: 'background-color 0.1s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: m.avatar_color || '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', position: 'relative' }}>
                                  {m.avatar_url ? <img src={getUrl(m.avatar_url)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : m.username.slice(0, 2).toUpperCase()}

                                  {/* Status Dot */}
                                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: statusColor, position: 'absolute', bottom: -2, right: -2, border: '2px solid #2f3136' }}></div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: '500', color: g.color }}>
                                    {m.display_name}
                                  </span>
                                  {/* {isMe && <span style={{ fontSize: '10px', color: '#b9bbbe' }}>Sen</span>} */}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {offline.length > 0 && (
                      <div style={{ opacity: 0.5 }}>
                        <div style={{ color: '#96989d', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px', marginTop: '20px' }}>
                          ÇEVRİMDIŞI — {offline.length}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {offline.map(m => (
                            <div key={m.username} onContextMenu={(e) => handleUserContextMenu(e, m)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', transition: 'background-color 0.1s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#36393f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px' }}>
                                {m.avatar_url ? <img src={getUrl(m.avatar_url)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : m.username.slice(0, 2).toUpperCase()}
                              </div>
                              <span style={{ color: '#72767d' }}>{m.display_name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
      </div >

      {/* CONTEXT MENU */}
      {
        contextMenu && (
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              background: 'rgba(24, 25, 28, 0.95)',
              backdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
              padding: '6px',
              zIndex: 9999,
              minWidth: '180px'
            }}
          >
            {/* CHANNEL CONTEXT MENU */}
            {contextMenu.channelId ? (
              <>
                <div
                  onClick={() => {
                    openRenameModal(contextMenu.channel);
                    setContextMenu(null);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    color: '#5865F2',
                    fontSize: '14px',
                    transition: 'background-color 0.1s',
                    marginBottom: '2px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2b2d31'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  ✏️ İsmi Değiştir
                </div>

                <div
                  onClick={() => {
                    handleDeleteChannel(contextMenu.channel);
                    setContextMenu(null);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    color: '#f04747',
                    fontSize: '14px',
                    transition: 'background-color 0.1s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4e0b0b'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  🗑️ Kanalı Sil
                </div>
              </>
            ) : (
              /* SERVER CONTEXT MENU */
              <>
                <div
                  onClick={() => {
                    const server = myServers.find(s => s.id === contextMenu.serverId);
                    if (server?.invite_code) {
                      navigator.clipboard.writeText(server.invite_code);
                      alert(`Davet kodu kopyalandı: ${server.invite_code}`);
                    }
                    setContextMenu(null);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    color: '#5865F2',
                    fontSize: '14px',
                    transition: 'background-color 0.1s',
                    marginBottom: '2px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2b2d31'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  🔗 Davet Kodu Paylaş
                </div>

                <div
                  onClick={() => handleLeaveServer(contextMenu.serverId)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    color: '#f04747',
                    fontSize: '14px',
                    transition: 'background-color 0.1s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4e0b0b'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  🚪 Sunucudan Ayrıl
                </div>
              </>
            )}
          </div>
        )
      }

      {/* USER CONTEXT MENU */}
      {userContextMenu && (
        <div
          style={{ position: 'fixed', top: userContextMenu.y, left: userContextMenu.x, background: '#18191c', borderRadius: '4px', padding: '8px', zIndex: 9999, boxShadow: '0 8px 16px rgba(0,0,0,0.24)', minWidth: '180px', border: '1px solid #2f3136' }}
          onMouseLeave={() => setUserContextMenu(null)}
        >
          <div style={{ padding: '0 8px 8px 8px', color: '#b9bbbe', fontSize: '11px', fontWeight: 'bold', borderBottom: '1px solid #2f3136', marginBottom: '8px' }}>ROLLER</div>
          {serverRoles.length > 0 ? serverRoles.map(r => {
            const freshUser = serverMembers.find(m => m.user_id === userContextMenu.user.user_id) || userContextMenu.user;
            const hasRole = freshUser.roles && freshUser.roles.includes(r.id);
            return (
              <div
                key={r.id}
                onClick={() => handleToggleRole(r.id, freshUser)}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', cursor: 'pointer', borderRadius: '2px', color: '#b9bbbe', fontSize: '14px', transition: 'background-color 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#5865F2'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#b9bbbe' }}
              >
                <div style={{ width: '16px', height: '16px', border: '1px solid #72767d', borderRadius: '3px', backgroundColor: hasRole ? r.color : 'transparent', marginRight: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {hasRole && <span style={{ fontSize: '10px', color: '#fff' }}>✓</span>}
                </div>
                {r.name}
              </div>
            )
          }) : (
            <div style={{ padding: '8px', color: '#72767d', fontSize: '12px', fontStyle: 'italic' }}>Hiç rol yok</div>
          )}
        </div>
      )}

      {
        (showCreateServer || showJoinServer || showAddFriend) && ( /* MODALS */
          <div onClick={() => { setShowCreateServer(false); setShowJoinServer(false); setShowAddFriend(false); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '400px', background: 'rgba(30, 30, 30, 0.95)', backdropFilter: 'blur(20px) saturate(180%)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '30px', borderRadius: '12px', boxShadow: '0 16px 48px 0 rgba(0, 0, 0, 0.6)' }}>
              <h2>{showCreateServer ? 'Sunucu Oluştur' : showJoinServer ? 'Sunucuya Katıl' : 'Arkadaş Ekle'}</h2>
              <p style={{ color: '#aaa', marginBottom: '20px' }}>
                {showCreateServer ? 'Yeni sunucunun adı ne olsun?' : showJoinServer ? 'Arkadaşının attığı davet kodunu gir.' : 'Örnek: admin#1234'}
              </p>
              <input
                autoFocus
                type="text"
                placeholder={showCreateServer ? "Sunucu Adı" : showJoinServer ? "Davet Kodu" : "username#1234"}
                value={showAddFriend ? friendInput : modalInput}
                onChange={e => showAddFriend ? setFriendInput(e.target.value) : setModalInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (showCreateServer ? handleCreateServer() : showJoinServer ? handleJoinServer() : handleAddFriend())}
                style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '5px', border: '1px solid #333', background: '#111', color: '#fff', cursor: 'text' }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowCreateServer(false); setShowJoinServer(false); setShowAddFriend(false); setFriendInput(""); }}
                  style={{ padding: '10px 20px', background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer', WebkitAppRegion: 'no-drag' }}
                >
                  İptal
                </button>
                <button
                  onClick={showCreateServer ? handleCreateServer : showJoinServer ? handleJoinServer : handleAddFriend}
                  style={{ padding: '10px 20px', background: '#5865F2', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', WebkitAppRegion: 'no-drag' }}
                >
                  {showCreateServer ? 'Oluştur' : showJoinServer ? 'Katıl' : 'Ekle'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* CHANNEL CREATE MODAL */}
      {
        showChannelCreateModal && (
          <div onClick={() => setShowChannelCreateModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '400px', background: 'rgba(30, 30, 30, 0.95)', backdropFilter: 'blur(20px) saturate(180%)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '30px', borderRadius: '12px', boxShadow: '0 16px 48px 0 rgba(0, 0, 0, 0.6)' }}>
              <h2>Kanal Oluştur</h2>
              <p style={{ color: '#aaa', marginBottom: '20px' }}>
                Yeni kanalın ismi ne olsun?
              </p>
              <input
                autoFocus
                type="text"
                placeholder="Kanal ismi"
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateChannel()}
                style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '5px', border: '1px solid #333', background: '#111', color: '#fff', cursor: 'text' }}
              />
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px', color: '#aaa' }}>Kanal Tipi</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setNewChannelType('text')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: newChannelType === 'text' ? '#5865F2' : '#333',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    💬 Yazılı
                  </button>
                  <button
                    onClick={() => setNewChannelType('voice')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: newChannelType === 'voice' ? '#5865F2' : '#333',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    🔊 Sesli
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowChannelCreateModal(false); setNewChannelName(''); }}
                  style={{ padding: '10px 20px', background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer', WebkitAppRegion: 'no-drag' }}
                >
                  İptal
                </button>
                <button
                  onClick={handleCreateChannel}
                  style={{ padding: '10px 20px', background: '#5865F2', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', WebkitAppRegion: 'no-drag' }}
                >
                  Oluştur
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* CHANNEL RENAME MODAL */}
      {
        showChannelRenameModal && (
          <div onClick={() => setShowChannelRenameModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '400px', background: 'rgba(30, 30, 30, 0.95)', backdropFilter: 'blur(20px) saturate(180%)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '30px', borderRadius: '12px', boxShadow: '0 16px 48px 0 rgba(0, 0, 0, 0.6)' }}>
              <h2>Kanal İsmini Değiştir</h2>
              <p style={{ color: '#aaa', marginBottom: '20px' }}>
                Kanalın yeni ismi ne olsun?
              </p>
              <input
                autoFocus
                type="text"
                placeholder="Yeni kanal ismi"
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRenameChannel()}
                style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '5px', border: '1px solid #333', background: '#111', color: '#fff', cursor: 'text' }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowChannelRenameModal(false); setNewChannelName(''); setChannelToRename(null); }}
                  style={{ padding: '10px 20px', background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer', WebkitAppRegion: 'no-drag' }}
                >
                  İptal
                </button>
                <button
                  onClick={handleRenameChannel}
                  style={{ padding: '10px 20px', background: '#5865F2', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', WebkitAppRegion: 'no-drag' }}
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        showSettings && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0f0f0f', display: 'flex', zIndex: 10000, overflow: 'hidden' }}>
            <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden' }}>

              {/* Sidebar */}
              <div style={{ width: '280px', backgroundColor: '#18191c', padding: '60px 20px 20px 40px', display: 'flex', flexDirection: 'column', flexShrink: 0, justifyContent: 'flex-start' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#aaa', marginBottom: '10px', paddingLeft: '10px' }}>KULLANICI AYARLARI</div>
                {['Profil', 'Ses ve Görüntü', 'Uygulama'].map(tab => {
                  const id = tab.toLowerCase().replace(/ /g, '_');
                  const isActive = activeSettingsTab === (tab === 'Profil' ? 'profile' : (tab === 'Ses ve Görüntü' ? 'voice' : 'app'));
                  return (
                    <div
                      key={tab}
                      onClick={() => setActiveSettingsTab(tab === 'Profil' ? 'profile' : (tab === 'Ses ve Görüntü' ? 'voice' : 'app'))}
                      style={{
                        padding: '6px 10px',
                        marginBottom: '2px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: isActive ? '#fff' : '#b9bbbe'
                      }}
                    >
                      {tab}
                    </div>
                  )
                })}

                <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                  <div
                    onClick={handleLogout}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: '#f04747',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>Çıkış Yap</span>
                    <span>🚪</span>
                  </div>
                </div>
              </div>

              {/* Content Content - Centered */}
              <div style={{ flex: 1, padding: '60px 40px', overflowY: 'auto', backgroundColor: '#202225' }}>
                <div style={{ maxWidth: '750px', marginLeft: '40px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>
                      {activeSettingsTab === 'profile' ? 'Profilim' : (activeSettingsTab === 'voice' ? 'Ses ve Görüntü' : 'Uygulama Ayarları')}
                    </h2>
                    <div
                      onClick={() => setShowSettings(false)}
                      style={{
                        cursor: 'pointer',
                        padding: '10px 20px',
                        border: '2px solid #aaa',
                        borderRadius: '4px',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#aaa',
                        position: 'fixed',
                        top: '60px',
                        right: '40px',
                        zIndex: 100
                      }}
                    >
                      <span>✕</span>
                      <span style={{ fontSize: '14px', fontWeight: 'bold' }}>ESC</span>
                    </div>
                  </div>

                  {activeSettingsTab === 'profile' && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '30px', marginBottom: '30px', padding: '24px', background: '#2f3136', borderRadius: '8px' }}>
                        <div style={{ width: '80px', minWidth: '80px', height: '80px', borderRadius: '50%', backgroundColor: isEditingProfile ? editAvatarColor : (authState.user.avatar_color || '#5865F2'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', border: isEditingProfile ? '2px dashed #fff' : 'none', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                          {authState.user.avatar_url ? (
                            <img src={`${getUrl(authState.user.avatar_url)}`} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            authState.user.username.slice(0, 2).toUpperCase()
                          )}

                          {isEditingProfile && (
                            <div
                              onClick={() => document.getElementById('avatar-upload').click()}
                              style={{
                                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                                cursor: 'pointer', fontSize: '12px', color: 'white', zIndex: 10
                              }}
                            >
                              <span style={{ fontSize: '24px' }}>📷</span>
                              <span style={{ fontSize: '8px', marginTop: '4px' }}>Değiştir</span>
                            </div>
                          )}
                          <input
                            type="file"
                            id="avatar-upload"
                            style={{ display: 'none' }}
                            accept="image/png, image/jpeg"
                            onChange={async (e) => {
                              const file = e.target.files[0];
                              if (!file) return;

                              const formData = new FormData();
                              formData.append('token', authState.token);
                              formData.append('file', file);

                              try {
                                const res = await fetch(`${getUrl('/user/profile/avatar')}`, {
                                  method: 'POST',
                                  body: formData
                                });
                                const data = await res.json();
                                if (data.status === 'success') {
                                  setAuthState(prev => ({
                                    ...prev,
                                    user: { ...prev.user, avatar_url: data.avatar_url }
                                  }));
                                } else {
                                  alert("Yükleme hatası: " + data.message);
                                }
                              } catch (err) {
                                console.error(err);
                                alert("Yükleme sırasında hata oluştu.");
                              }
                            }}
                          />
                        </div>
                        {isEditingProfile && (
                          <button onClick={() => document.getElementById('avatar-upload').click()} style={{ padding: '6px 12px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', alignSelf: 'center', marginRight: '20px' }}>
                            Resim Yükle
                          </button>
                        )}
                        <div style={{ flex: 1 }}>
                          {isEditingProfile ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <input
                                value={editDisplayName}
                                onChange={(e) => setEditDisplayName(e.target.value)}
                                placeholder="Görünen İsim"
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: 'white' }}
                              />
                              <div style={{ display: 'flex', gap: '5px' }}>
                                {['#5865F2', '#3BA55C', '#FAA61A', '#ED4245', '#EB459E', '#747F8D'].map(color => (
                                  <div
                                    key={color}
                                    onClick={() => setEditAvatarColor(color)}
                                    style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: color, cursor: 'pointer', border: editAvatarColor === color ? '2px solid white' : 'none' }}
                                  />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{authState.user.display_name || authState.user.username}</div>
                              <div style={{ color: '#aaa' }}>#{authState.user.discriminator}</div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            if (isEditingProfile) {
                              // SAVE
                              try {
                                const res = await fetch(`${getUrl('/user/profile/update')}`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ token: authState.token, display_name: editDisplayName, avatar_color: editAvatarColor })
                                });
                                const data = await res.json();
                                if (data.status === 'success') {
                                  setAuthState(prev => ({ ...prev, user: { ...prev.user, ...data.user } }));
                                  setIsEditingProfile(false);
                                } else {
                                  alert(data.message);
                                }
                              } catch (e) { console.error(e); }
                            } else {
                              // ENTER EDIT MODE
                              setEditDisplayName(authState.user.display_name || authState.user.username);
                              setEditAvatarColor(authState.user.avatar_color || '#5865F2');
                              setIsEditingProfile(true);
                            }
                          }}
                          style={{ marginLeft: 'auto', padding: '8px 16px', backgroundColor: isEditingProfile ? '#3BA55C' : '#5865F2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          {isEditingProfile ? 'Kaydet' : 'Profili Düzenle'}
                        </button>
                        {isEditingProfile && (
                          <button onClick={() => setIsEditingProfile(false)} style={{ marginLeft: '10px', padding: '8px 16px', backgroundColor: '#ED4245', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>İptal</button>
                        )}
                      </div>

                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#aaa', marginBottom: '8px' }}>KULLANICI ADI</label>
                        <div style={{ fontSize: '14px' }}>{authState.user.username} <span style={{ color: '#aaa', fontSize: '12px' }}>#{authState.user.discriminator}</span></div>
                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'voice' && (
                    <div>
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#aaa', marginBottom: '8px' }}>GİRİŞ CİHAZI (MİKROFON)</label>
                        <select
                          value={selectedInputId}
                          onChange={(e) => setSelectedInputId(e.target.value)}
                          style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e1e', border: '1px solid #333', color: 'white', borderRadius: '4px' }}
                        >
                          <option value="default">Varsayılan</option>
                          {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 5)}...`}</option>)}
                        </select>
                      </div>

                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#aaa', marginBottom: '8px' }}>ÇIKIŞ CİHAZI (HOPARLÖR)</label>
                        <select
                          value={selectedOutputId}
                          onChange={(e) => setSelectedOutputId(e.target.value)}
                          style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e1e', border: '1px solid #333', color: 'white', borderRadius: '4px' }}
                        >
                          <option value="default">Varsayılan</option>
                          {outputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 5)}...`}</option>)}
                        </select>
                      </div>

                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '20px 0' }}></div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Gürültü Engelleme (Krisp)</div>
                          <div style={{ fontSize: '12px', color: '#aaa' }}>Arka plan seslerini yapay zeka ile temizle.</div>
                        </div>
                        <div
                          onClick={toggleNoiseCancellation}
                          style={{
                            width: '40px',
                            height: '24px',
                            backgroundColor: isNoiseCancelled ? '#34C759' : '#72767d',
                            borderRadius: '12px',
                            position: 'relative',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s'
                          }}
                        >
                          <div style={{
                            width: '18px',
                            height: '18px',
                            backgroundColor: 'white',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: '3px',
                            left: isNoiseCancelled ? '19px' : '3px',
                            transition: 'left 0.2s'
                          }}></div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Yankı Engelleme</div>
                          <div style={{ fontSize: '12px', color: '#aaa' }}>Sesinizin yankı yapmasını önler.</div>
                        </div>
                        <div style={{ width: '40px', height: '24px', backgroundColor: '#34C759', borderRadius: '12px', position: 'relative', cursor: 'pointer' }}>
                          <div style={{ width: '18px', height: '18px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: '19px' }}></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'app' && (
                    <div>
                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#aaa', marginBottom: '8px' }}>TEMA</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <div
                            onClick={() => { setTheme('dark'); localStorage.setItem('safezone_theme', 'dark'); }}
                            style={{ width: '100px', height: '80px', backgroundColor: '#2f3136', border: theme === 'dark' ? '2px solid #5865F2' : '2px solid transparent', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}
                          >
                            Koyu
                          </div>
                          <div
                            onClick={() => { setTheme('light'); localStorage.setItem('safezone_theme', 'light'); }}
                            style={{ width: '100px', height: '80px', backgroundColor: '#fff', border: theme === 'light' ? '2px solid #5865F2' : '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}
                          >
                            Açık
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Windows Başlangıcında Çalıştır</div>
                          <div style={{ fontSize: '12px', color: '#aaa' }}>Bilgisayar açıldığında SafeZone otomatik başlasın.</div>
                        </div>
                        <div style={{ width: '40px', height: '24px', backgroundColor: '#72767d', borderRadius: '12px', position: 'relative', cursor: 'pointer' }}>
                          <div style={{ width: '18px', height: '18px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: '3px' }}></div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        )
      }
      {/* SERVER SETTINGS MODAL */}
      {showServerSettings && selectedServer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0f0f0f', display: 'flex', zIndex: 10000, overflow: 'hidden' }}>
          <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden' }}>
            {/* Sidebar */}
            <div style={{ width: '280px', backgroundColor: '#18191c', padding: '60px 20px 20px 40px', display: 'flex', flexDirection: 'column', flexShrink: 0, justifyContent: 'flex-start' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#aaa', marginBottom: '10px', paddingLeft: '10px' }}>SUNUCU AYARLARI</div>

              <div style={{ padding: '6px 10px', marginBottom: '2px', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent', color: '#b9bbbe' }}>Genel Görünüm</div>
              <div style={{ padding: '6px 10px', marginBottom: '2px', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>Roller</div>
              <div style={{ padding: '6px 10px', marginBottom: '2px', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent', color: '#b9bbbe' }}>Emojiler</div>

              <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                <div onClick={() => setShowServerSettings(false)} style={{ padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', color: '#aaa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Geri Dön</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: '60px 40px', overflowY: 'auto', backgroundColor: '#202225' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>Roller</h2>
                <div onClick={() => setShowServerSettings(false)} style={{ cursor: 'pointer', padding: '10px 20px', border: '2px solid #aaa', borderRadius: '4px', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', color: '#aaa', position: 'fixed', top: '60px', right: '40px', zIndex: 100 }}>
                  <span>✕</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>ESC</span>
                </div>
              </div>

              <RoleSettings serverId={selectedServer.id} token={authState.token} />
            </div>
          </div>
        </div>
      )}

      {/* CONTEXT MENU */}
      {
        messageContextMenu && (
          <div style={{
            position: 'fixed',
            top: messageContextMenu.y,
            left: messageContextMenu.x,
            background: '#18191c',
            borderRadius: '4px',
            padding: '5px',
            zIndex: 9999,
            boxShadow: '0 8px 16px rgba(0,0,0,0.24)',
            minWidth: '150px'
          }}>
            <div
              onClick={startEditing}
              className="context-item"
              style={{ padding: '8px 12px', cursor: 'pointer', color: '#dcddde', borderRadius: '2px', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#4752c4'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              ✏️ Düzenle
            </div>
            <div
              onClick={handleDeleteMessage}
              className="context-item"
              style={{ padding: '8px 12px', cursor: 'pointer', color: '#ed4245', borderRadius: '2px', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#ed4245'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#ed4245' }}
            >
              🗑️ Sil
            </div>
          </div>
        )
      }


    </div >
  );
}

export default App
