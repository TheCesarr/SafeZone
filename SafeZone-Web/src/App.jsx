import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid';
import ServerSidebar from './components/ServerSidebar';
import { getUrl } from './utils/api';
import UserFooter from './components/UserFooter';
import ChatArea from './components/ChatArea';
import ChannelList from './components/ChannelList';
import VoiceRoom from './components/VoiceRoom';
import FriendsDashboard from './components/FriendsDashboard';
import ServerSettings from './components/ServerSettings';
import SettingsPanel from './components/SettingsPanel';
import { ServerContextMenu, UserContextMenu, MessageContextMenu } from './components/ContextMenus';
import Modal from './components/Modal';
import { getTheme, getPaletteName } from './utils/themes';
import StreamOverlay from './components/StreamOverlay';
import MemberList from './components/MemberList';
import { useToast } from './hooks/useToast';
import { useUnread } from './hooks/useUnread';
import ToastContainer from './components/common/Toast';

// NEW HOOKS
import { useAuth } from './hooks/useAuth';
import { useServerData } from './hooks/useServerData';
import { useWebRTC } from './hooks/useWebRTC';
import { useChat } from './hooks/useChat';
import { useLobby } from './hooks/useLobby';

import AdminDashboard from './components/AdminDashboard'; // Import AdminDashboard

function App() {
  // --- 1. CONFIG & AUTH ---
  // v2.0.0: Server IP is hardcoded in api.js, no state needed here.

  // Toast Hook
  const { toasts, showToast, removeToast } = useToast();

  // Auth Hook
  const { authState, authMode, setAuthMode, authError, setAuthError, handleLogin, handleRegister, handleResetPassword, handleLogout: hookLogout, handleAdminLogin, isLoading: authLoading, updateUser } = useAuth();
  const [authInput, setAuthInput] = useState({ email: '', username: '', password: '', display_name: '', recovery_pin: '' });

  // Refs (used by multiple hooks)
  const uuid = useRef(localStorage.getItem('safezone_uuid') || uuidv4())
  useEffect(() => localStorage.setItem('safezone_uuid', uuid.current), [])
  const roomWs = useRef(null)
  const chatWs = useRef(null)

  // --- 1.1 DEVICES STATE ---
  const [inputDevices, setInputDevices] = useState([])
  const [outputDevices, setOutputDevices] = useState([])
  const [selectedInputId, setSelectedInputId] = useState('default')
  const [selectedOutputId, setSelectedOutputId] = useState('default')

  // Audio Processing Settings (New)
  const [audioSettings, setAudioSettings] = useState({
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true
  });

  // --- 2. LOGIC HOOKS ---
  const serverData = useServerData(authState);
  const unread = useUnread();

  // Admin View State
  const [adminView, setAdminView] = useState(true);

  const lobby = useLobby(authState, uuid, serverData.fetchServers, (sender, disc) => {
    showToast(`${sender}#${disc} sana arkadaşlık isteği gönderdi!`, 'info');
    serverData.fetchFriends();
  }, (sender) => {
    unread.markDMUnread(sender);
  });

  // Chat & Voice Hooks (Interconnected)
  const chat = useChat(authState, uuid, chatWs, roomWs, () => {
    // onUnreadMessage logic...
  });
  const webrtc = useWebRTC(authState, uuid, roomWs, chat.handleIncomingMessage, selectedInputId, selectedOutputId, audioSettings);

  // --- 3. UI STATE (Specific to App Layout) ---
  const [showCreateServer, setShowCreateServer] = useState(false)

  // ... (keeping other states)
  const [showJoinServer, setShowJoinServer] = useState(false)
  const [modalInput, setModalInput] = useState("")

  const [showChannelCreateModal, setShowChannelCreateModal] = useState(false)
  const [showChannelRenameModal, setShowChannelRenameModal] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelType, setNewChannelType] = useState('text')

  // Context Menus
  const [contextMenu, setContextMenu] = useState(null)
  const [userContextMenu, setUserContextMenu] = useState(null)
  const [serverRoles, setServerRoles] = useState([])

  // Settings & Panels
  const [showSettings, setShowSettings] = useState(false)
  const [showServerSettings, setShowServerSettings] = useState(false)
  const [activeSettingsTab, setActiveSettingsTab] = useState('profile')
  const [channelListWidth, setChannelListWidth] = useState(240)
  const [memberListWidth, setMemberListWidth] = useState(240)
  const [isResizing, setIsResizing] = useState(null)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)

  // Profile Editing
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editAvatarColor, setEditAvatarColor] = useState('#5865F2')



  // Friends UI
  const [showFriendsList, setShowFriendsList] = useState(false)
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [friendInput, setFriendInput] = useState("")

  // Theme
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('safezone_theme');
    if (saved) { try { return JSON.parse(saved); } catch (e) { } }
    return { palette: 'midnight', mode: 'dark' };
  });

  const colors = getTheme(theme.palette, theme.mode);

  // --- 4. EFFECTS & HELPERS ---

  // Build Type State
  const [buildType, setBuildType] = useState('client');

  // Fetch Build Type on Mount
  useEffect(() => {
    if (window.SAFEZONE_API) {
      window.SAFEZONE_API.getBuildType().then(type => {
        setBuildType(type);
      });
    }
  }, []);

  // Admin Auto-Login
  // Admin Auto-Login Logic
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (window.SAFEZONE_API) {
        try {
          // Add a small delay to ensure IPC is ready
          await new Promise(r => setTimeout(r, 500));

          const type = await window.SAFEZONE_API.getBuildType();
          // console.log('Build Type:', type); // Already fetched above

          if (type === 'admin') {
            const secret = await window.SAFEZONE_API.getAdminSecret();
            console.log('Admin Secret Found:', !!secret);
            if (secret) {
              // Must await this to keep loading screen up
              await handleAdminLogin(secret);
              // FORCE SYSADMIN (Failsafe)
              if (authState.user) {
                authState.user.is_sysadmin = true;
              }
            }
          }
        } catch (e) {
          console.error("Admin Check Error:", e);
        }
      }
      setIsCheckingAdmin(false);
    };

    // Only run if we don't have a token
    if (!authState.token) {
      checkAdmin();
    } else {
      setIsCheckingAdmin(false);
    }
  }, []); // Run once on mount

  // Theme Background
  useEffect(() => {
    document.body.style.backgroundColor = colors.background;
    document.body.style.color = colors.text;
  }, [theme, colors]);

  // Auth Sync
  useEffect(() => {
    if (authState.token) {
      // setIsServerSet(true); // No longer needed
      // Hooks handle data fetching automatically on token change
    }
  }, [authState.token]);

  // Audio Device Enumeration
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        setInputDevices(inputs);
        setOutputDevices(outputs);
        if (selectedInputId === 'default' && inputs.length > 0 && !inputs.find(d => d.deviceId === 'default')) {
          setSelectedInputId(inputs[0].deviceId);
        }
        if (selectedOutputId === 'default' && outputs.length > 0 && !outputs.find(d => d.deviceId === 'default')) {
          setSelectedOutputId(outputs[0].deviceId);
        }
      } catch (e) { console.error("Error enumerating devices:", e); }
    };
    getDevices();
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
  }, []);

  // Handle Channel Selection & Connection binding
  useEffect(() => {
    if (serverData.selectedChannel) {
      if (serverData.selectedChannel.type === 'voice') {
        webrtc.connectToRoom(serverData.selectedChannel);
      } else {
        chat.connectToChannel(serverData.selectedChannel);
        chat.fetchChannelMessages(serverData.selectedChannel.id);
      }
    }
  }, [serverData.selectedChannel]);


  // Wrappers for UI Actions
  const handleAuthSubmit = () => {
    if (authMode === 'login') handleLogin(authInput.email, authInput.password);
    else if (authMode === 'register') handleRegister(authInput.username, authInput.email, authInput.password, authInput.display_name, authInput.recovery_pin);
    else if (authMode === 'reset') handleResetPassword(authInput.email, authInput.recovery_pin, authInput.password);
  }

  const doLogout = () => {
    webrtc.disconnectVoice();
    hookLogout();
  }

  // Handle Create/Join Server
  const onSimpleCreateServer = async () => {
    const success = await serverData.handleCreateServer(modalInput);
    if (success) { setShowCreateServer(false); setModalInput(""); }
  }
  const onSimpleJoinServer = async () => {
    const success = await serverData.handleJoinServer(modalInput);
    if (success) { setShowJoinServer(false); setModalInput(""); }
  }

  // Handle Channel Create
  const onSimpleCreateChannel = async () => {
    const success = await serverData.handleCreateChannel(serverData.selectedServer.id, newChannelName, newChannelType);
    if (success) { setShowChannelCreateModal(false); setNewChannelName(""); }
  }

  // Handle Resize
  const handleResizeStart = (e, panel) => { e.preventDefault(); setIsResizing(panel); resizeStartX.current = e.clientX; resizeStartWidth.current = panel === 'channel' ? channelListWidth : memberListWidth; }
  const handleResizeMove = (e) => {
    if (!isResizing) return;
    const delta = e.clientX - resizeStartX.current;
    if (isResizing === 'channel') setChannelListWidth(Math.max(180, Math.min(600, resizeStartWidth.current + delta)));
  }
  const handleResizeEnd = () => setIsResizing(null);
  useEffect(() => {
    if (isResizing) { document.addEventListener('mousemove', handleResizeMove); document.addEventListener('mouseup', handleResizeEnd); return () => { document.removeEventListener('mousemove', handleResizeMove); document.removeEventListener('mouseup', handleResizeEnd); } }
  }, [isResizing]);

  // Context Menu Helpers
  const handleServerRightClick = (e, server) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, serverId: server.id }); }
  const handleUserContextMenu = (e, user) => { e.preventDefault(); e.stopPropagation(); setUserContextMenu({ x: e.clientX, y: e.clientY, user }); }

  // Volume Control Helpers
  const handleRemoteVolume = (userId, vol) => {
    if (!webrtc.remoteAudioRefs.current) return;
    const audios = webrtc.remoteAudioRefs.current[userId];
    if (Array.isArray(audios)) audios.forEach(a => { if (a) a.volume = vol });
    else if (audios) audios.volume = vol;
  };

  const handleRemoteMute = (userId) => {
    if (!webrtc.remoteAudioRefs.current) return;
    const audios = webrtc.remoteAudioRefs.current[userId];
    const isMuted = Array.isArray(audios) ? audios[0]?.muted : audios?.muted;
    if (Array.isArray(audios)) audios.forEach(a => { if (a) a.muted = !isMuted });
    else if (audios) audios.muted = !isMuted;

    // Force Menu Update (Hack)
    setUserContextMenu(prev => ({ ...prev }));
  };

  // Close menus
  useEffect(() => { const c = () => setContextMenu(null); if (contextMenu) document.addEventListener('click', c); return () => document.removeEventListener('click', c); }, [contextMenu]);
  useEffect(() => { const c = () => setUserContextMenu(null); if (userContextMenu) document.addEventListener('click', c); return () => document.removeEventListener('click', c); }, [userContextMenu]);


  // --- 5. RENDER (The big block) ---

  if (isCheckingAdmin) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#2f3136',
        color: '#fff',
        flexDirection: 'column',
        gap: 20,
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ fontSize: 40 }}>🛡️</div>
        <h2>SafeZone Başlatılıyor...</h2>
        <p style={{ color: '#b9bbbe' }}>Sistem kontrol ediliyor...</p>
      </div>
    );
  }

  // If SysAdmin and in Admin View AND Build Type is Admin, show Dashboard
  if (authState.user?.is_sysadmin && adminView && buildType === 'admin') {
    return (
      <AdminDashboard
        authState={authState}
        onLogout={() => {
          console.log("Logout triggered");
          doLogout();
        }}
        colors={colors}
        onJoinServer={(server) => {
          // Logic to join server from Dashboard
          // Assuming server object has ID
          // Check if we are already member?
          // For now, let's just switch view and try to select.
          // If not member, we might need a specific 'join' call for admin.
          setAdminView(false);
          if (server) serverData.selectServer(server);
        }}
        onSwitchToClient={() => setAdminView(false)}
      />
    )
  }

  if (!authState.token) {
    return (
      <div style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=2670&auto=format&fit=crop")', backgroundSize: 'cover', backgroundPosition: 'center', height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Inter", sans-serif' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)' }}></div>
        <div style={{ width: '480px', padding: '32px', background: colors.card, borderRadius: '5px', zIndex: 1, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <h2 style={{ color: colors.text, marginBottom: '20px', textAlign: 'center', fontSize: '28px' }}>SafeZone v2.0</h2>

          <h3 style={{ color: '#b9bbbe', marginBottom: '20px', textAlign: 'center', fontSize: '18px' }}>
            {authMode === 'login' ? 'Giriş Yap' : authMode === 'register' ? 'Hesap Oluştur' : 'Şifre Sıfırla'}
          </h3>

          {authError && <div style={{ color: '#ed4245', marginBottom: 15, padding: '10px', background: 'rgba(237, 66, 69, 0.1)', borderRadius: '3px', border: '1px solid #ed4245' }}>{authError}</div>}

          {authMode === 'reset' && (
            <>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>E-POSTA</label>
                <input type="email" value={authInput.email} onChange={e => setAuthInput({ ...authInput, email: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
              </div>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>KURTARMA PIN (4 Haneli)</label>
                <input type="text" maxLength="4" value={authInput.recovery_pin} onChange={e => setAuthInput({ ...authInput, recovery_pin: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>YENİ ŞİFRE</label>
                <input type="password" value={authInput.password} onChange={e => setAuthInput({ ...authInput, password: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
              </div>
            </>
          )}

          {authMode === 'login' && (
            <>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>E-POSTA</label>
                <input type="email" value={authInput.email} onChange={e => setAuthInput({ ...authInput, email: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>ŞİFRE</label>
                <input type="password" value={authInput.password} onChange={e => setAuthInput({ ...authInput, password: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
              </div>
            </>
          )}

          {authMode === 'register' && (
            <>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>E-POSTA (*)</label>
                <input type="email" value={authInput.email} onChange={e => setAuthInput({ ...authInput, email: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
              </div>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>KULLANICI ADI (*)</label>
                <input type="text" value={authInput.username} onChange={e => setAuthInput({ ...authInput, username: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
              </div>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>GÖRÜNEN İSİM</label>
                <input type="text" value={authInput.display_name} onChange={e => setAuthInput({ ...authInput, display_name: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
              </div>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>ŞİFRE (*)</label>
                <input type="password" value={authInput.password} onChange={e => setAuthInput({ ...authInput, password: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>KURTARMA PIN (4 Haneli - Şifre Sıfırlama İçin)</label>
                <input type="text" maxLength="4" value={authInput.recovery_pin} onChange={e => setAuthInput({ ...authInput, recovery_pin: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
              </div>
            </>
          )}

          <button onClick={handleAuthSubmit} style={{ width: '100%', padding: 10, background: colors.accent, color: '#fff', border: 'none', borderRadius: 3, fontWeight: 'bold', cursor: 'pointer', transition: 'filter 0.2s', marginTop: '10px' }} onMouseOver={(e) => e.target.style.filter = 'brightness(1.1)'} onMouseOut={(e) => e.target.style.filter = 'brightness(1)'}>
            {authMode === 'login' ? 'Giriş Yap' : authMode === 'register' ? 'Kayıt Ol' : 'Şifreyi Sıfırla'}
          </button>

          <div style={{ marginTop: 20, fontSize: 14, color: '#72767d', textAlign: 'center' }}>
            {authMode === 'login' ?
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span>Hesabın yok mu? <span onClick={() => setAuthMode('register')} style={{ color: colors.accent, cursor: 'pointer', fontWeight: 'bold' }}>Kaydol</span></span>
                  <span onClick={() => setAuthMode('reset')} style={{ fontSize: 12, color: colors.accent, cursor: 'pointer' }}>Şifremi Unuttum</span>
                </div>
              </> :
              authMode === 'register' ?
                <>Zaten hesabın var mı? <span onClick={() => setAuthMode('login')} style={{ color: colors.accent, cursor: 'pointer', fontWeight: 'bold' }}>Giriş Yap</span></> :
                <>Hatırladın mı? <span onClick={() => setAuthMode('login')} style={{ color: colors.accent, cursor: 'pointer', fontWeight: 'bold' }}>Giriş Yap</span></>
            }
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', width: '100vw', height: '100vh', background: `linear-gradient(135deg, ${colors.background} 0%, ${colors.sidebar} 100%)`, color: colors.text, overflow: 'hidden' }}>

      {/* SIDEBAR */}
      <ServerSidebar
        myServers={serverData.myServers}
        selectedServer={serverData.selectedServer}
        showFriendsList={showFriendsList}
        unreadChannels={unread.unreadChannels}
        unreadDMs={unread.unreadDMs}
        friendRequestsCount={serverData.friendRequests.incoming.length}
        onServerClick={(s) => { serverData.selectServer(s); setShowFriendsList(false); lobby.setSelectedDM(null); }}
        onFriendsClick={() => { setShowFriendsList(true); serverData.selectServer(null); lobby.setSelectedDM(null); }}
        onCreateServerClick={() => setShowCreateServer(true)}
        onJoinServerClick={() => setShowJoinServer(true)}
        onSettingsClick={() => setShowSettings(true)}
        handleServerRightClick={handleServerRightClick}
        colors={colors}
        isSysAdmin={authState.user?.is_sysadmin && buildType === 'admin'}
        onAdminClick={() => setAdminView(true)}
      />

      {/* CHANNEL / FRIENDS LIST */}
      <ChannelList
        colors={colors}
        width={channelListWidth}
        showFriendsList={showFriendsList}
        friendRequests={serverData.friendRequests.incoming || []}
        friends={serverData.friends}
        onlineUserIds={lobby.onlineUserIds}
        userStatuses={lobby.userStatuses}
        handleRespondRequest={(username, action) => {
          serverData.respondFriendRequest(username, action);
        }}
        setShowAddFriend={setShowAddFriend}
        handleRemoveFriend={(username) => {
          const f = serverData.friends.find(fr => fr.username === username);
          if (f) serverData.removeFriend(f.id);
        }}
        selectedServer={serverData.selectedServer}
        serverMembers={serverData.serverMembers}
        setShowChannelCreateModal={setShowChannelCreateModal}
        // UNREAD PROPS
        unreadChannels={unread.unreadChannels}
        unreadDMs={unread.unreadDMs}

        // HANDLERS
        handleChannelClick={(ch) => {
          serverData.setSelectedChannel(ch);
          unread.markChannelRead(ch.id);
        }}
        handleStartDM={(friend) => {
          lobby.startDM(friend);
          unread.markDMRead(friend.username);
        }}
        setContextMenu={setContextMenu}
        handleUserContextMenu={handleUserContextMenu} // PASSED HERE
        selectedChannel={serverData.selectedChannel}
        activeVoiceChannel={webrtc.activeVoiceChannel}
        roomDetails={lobby.roomDetails}
        speakingUsers={webrtc.speakingUsers}
        voiceStates={webrtc.voiceStates}
        authState={authState}
        isMuted={webrtc.isMuted}
        isDeafened={webrtc.isDeafened}
        isNoiseCancelled={webrtc.isNoiseCancelled}
        ping={lobby.ping}
        onDisconnect={webrtc.disconnectVoice}
        onToggleMute={webrtc.toggleMute}
        onToggleDeafen={webrtc.toggleDeafen}
        onToggleNoiseCancellation={webrtc.toggleNoiseCancellation}
        onStatusChange={lobby.handleStatusChange}
        onScreenShare={webrtc.startScreenShare}
        stopScreenShare={webrtc.stopScreenShare}
        isScreenSharing={webrtc.isScreenSharing}
        handleServerSettings={() => setShowServerSettings(true)}
      >
        {/* Resize Handle */}
        <div onMouseDown={(e) => handleResizeStart(e, 'channel')} style={{ position: 'absolute', top: 0, right: -2, width: '4px', height: '100%', cursor: 'ew-resize', zIndex: 10 }} />
      </ChannelList>

      {/* MAIN AREA */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'transparent', order: 3 }}>
        {/* Header */}
        <div style={{ padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(22,22,22,0.6)', backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>{lobby.selectedDM ? '@' : (serverData.selectedChannel?.type === 'voice' ? '🔊' : '#')}</span>
            <span style={{ fontWeight: 'bold' }}>{lobby.selectedDM ? lobby.selectedDM.username : (serverData.selectedChannel?.name || "Hoşgeldin")}</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}> {/* New Flex Container for Chat + MemberList */}
          {(serverData.selectedChannel?.type === 'text' || lobby.selectedDM) ? (
            <>
              <ChatArea
                colors={colors}
                selectedChannel={serverData.selectedChannel}
                selectedDM={lobby.selectedDM}
                messages={lobby.selectedDM ? lobby.dmHistory : chat.messages}
                dmHistory={lobby.dmHistory}
                currentUser={authState.user}
                inputText={chat.inputText}
                setInputText={chat.setInputText}
                onSendMessage={chat.sendChatMessage}
                onSendDM={() => lobby.sendDM(chat.inputText)}
                handleTyping={chat.handleTyping}
                typingUsers={chat.typingUsers}
                attachment={chat.attachment}
                setAttachment={chat.setAttachment}
                isUploading={chat.isUploading}
                handleFileSelect={chat.handleFileSelect}
                handleMessageContextMenu={chat.handleMessageContextMenu}
                editingMessageId={chat.editingMessageId}
                setEditingMessageId={chat.setEditingMessageId}
                editText={chat.editText}
                setEditText={chat.setEditText}
                submitEdit={chat.submitEdit}
                onlineMembers={serverData.serverMembers || []}
              />

              {/* Member List - Only show in server text channels (not DMs for now, unless requested) */}
              {serverData.selectedChannel?.type === 'text' && !lobby.selectedDM && (
                <MemberList
                  members={serverData.serverMembers}
                  onlineUserIds={lobby.onlineUserIds}
                  userStatuses={lobby.userStatuses}
                  colors={colors}
                  width={memberListWidth}
                  onResizeStart={handleResizeStart}
                  handleUserContextMenu={handleUserContextMenu}
                />
              )}
            </>
          ) : (serverData.selectedChannel?.type === 'voice') ? (
            <VoiceRoom
              colors={colors}
              connectedUsers={webrtc.connectedUsers}
              speakingUsers={webrtc.speakingUsers}
              voiceStates={webrtc.voiceStates}
              channelName={serverData.selectedChannel.name}
              remoteStreams={webrtc.remoteStreams}
              activeUsersRef={{ current: webrtc.connectedUsers }}
              isScreenSharing={webrtc.isScreenSharing}
              screenStreamRef={webrtc.screenStreamRef}
              remoteScreenStreams={webrtc.remoteScreenStreams}
              remoteAudioRefs={webrtc.remoteAudioRefs}
              serverMembers={serverData.serverMembers}
              screenSources={webrtc.screenSources}
              startScreenShareWithSource={webrtc.startScreenShareWithSource}
              onCancelScreenPicker={() => webrtc.setScreenSources([])}
            />
          ) : (
            <FriendsDashboard
              colors={colors}
              friends={serverData.friends}
              requests={serverData.friendRequests}
              onlineUserIds={lobby.onlineUserIds}
              userStatuses={lobby.userStatuses}
              setShowAddFriend={setShowAddFriend}
              handleAddFriend={serverData.addFriend}
              handleRemoveFriend={serverData.removeFriend}
              handleRespondRequest={serverData.respondFriendRequest}
              handleStartDM={(friend) => {
                lobby.startDM(friend);
                unread.markDMRead(friend.username);
              }}
            />
          )}
        </div>
      </div>

      {/* --- GLOBAL PERSISTENT AUDIO --- */}
      {/* Renders audio for connected users regardless of current view */}
      {webrtc.connectedUsers.map(user => (
        <audio
          key={user.uuid || user.username}
          ref={el => {
            if (!webrtc.remoteAudioRefs?.current) return;
            // Use username as key if uuid missing (consistent with other parts)
            const key = user.uuid || user.username;
            if (!webrtc.remoteAudioRefs.current[key]) webrtc.remoteAudioRefs.current[key] = [];

            // Store as first element (Index 0 is Mic)
            webrtc.remoteAudioRefs.current[key][0] = el;

            if (el && webrtc.remoteStreams && webrtc.remoteStreams[key]) {
              // Only update if srcObject is different to avoid interruptions
              if (el.srcObject !== webrtc.remoteStreams[key]) {
                el.srcObject = webrtc.remoteStreams[key];
              }
            }
          }}
          autoPlay
          playsInline
          // Apply Output Device
          onPlay={(e) => {
            if (selectedOutputId && selectedOutputId !== 'default' && e.target.setSinkId) {
              e.target.setSinkId(selectedOutputId).catch(console.error);
            }
          }}
        />
      ))}


      {/* MODALS */}
      {
        showCreateServer && (
          <Modal title="Sunucu Oluştur" onClose={() => { setShowCreateServer(false); setModalInput(""); }} colors={colors}>
            <p style={{ color: '#aaa', marginBottom: '16px' }}>Yeni sunucunun adı ne olsun?</p>
            <input autoFocus type="text" placeholder="Sunucu Adı" value={modalInput} onChange={e => setModalInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSimpleCreateServer()} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#fff' }} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => { setShowCreateServer(false); setModalInput(""); }} className="interactive-button" style={{ padding: '8px 16px', background: 'transparent', color: '#aaa', border: 'none' }}>İptal</button>
              <button onClick={onSimpleCreateServer} className="interactive-button" style={{ padding: '8px 16px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '4px' }}>Oluştur</button>
            </div>
          </Modal>
        )
      }

      {
        showJoinServer && (
          <Modal title="Sunucuya Katıl" onClose={() => { setShowJoinServer(false); setModalInput(""); }} colors={colors}>
            <p style={{ color: '#aaa', marginBottom: '16px' }}>Arkadaşının attığı davet kodunu gir.</p>
            <input autoFocus type="text" placeholder="Davet Kodu" value={modalInput} onChange={e => setModalInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSimpleJoinServer()} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#fff' }} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => { setShowJoinServer(false); setModalInput(""); }} className="interactive-button" style={{ padding: '8px 16px', background: 'transparent', color: '#aaa', border: 'none' }}>İptal</button>
              <button onClick={onSimpleJoinServer} className="interactive-button" style={{ padding: '8px 16px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '4px' }}>Katıl</button>
            </div>
          </Modal>
        )
      }

      {
        showChannelCreateModal && (
          <Modal title="Kanal Oluştur" onClose={() => setShowChannelCreateModal(false)} colors={colors}>
            <input autoFocus type="text" placeholder="Kanal ismi" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSimpleCreateChannel()} style={{ width: '100%', padding: '10px', marginBottom: '16px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#fff' }} />
            <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
              <button onClick={() => setNewChannelType('text')} className="interactive-button" style={{ flex: 1, padding: '10px', background: newChannelType === 'text' ? colors.accent : '#333', color: '#fff', border: 'none', borderRadius: '4px' }}>💬 Yazılı</button>
              <button onClick={() => setNewChannelType('voice')} className="interactive-button" style={{ flex: 1, padding: '10px', background: newChannelType === 'voice' ? colors.accent : '#333', color: '#fff', border: 'none', borderRadius: '4px' }}>🔊 Sesli</button>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowChannelCreateModal(false); setNewChannelName(""); }} className="interactive-button" style={{ padding: '8px 16px', background: 'transparent', color: '#aaa', border: 'none' }}>İptal</button>
              <button onClick={onSimpleCreateChannel} className="interactive-button" style={{ padding: '8px 16px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '4px' }}>Oluştur</button>
            </div>
          </Modal>
        )
      }

      {
        showAddFriend && (
          <Modal title="Arkadaş Ekle" onClose={() => { setShowAddFriend(false); setFriendInput(""); }} colors={colors}>
            <p style={{ color: '#aaa', marginBottom: '16px' }}>Örnek: admin#1234</p>
            <input autoFocus type="text" placeholder="username#1234" value={friendInput} onChange={e => setFriendInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && serverData.addFriend(friendInput).then(s => s && setShowAddFriend(false))} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#fff' }} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => { setShowAddFriend(false); setFriendInput(""); }} className="interactive-button" style={{ padding: '8px 16px', background: 'transparent', color: '#aaa', border: 'none' }}>İptal</button>
              <button onClick={() => {
                serverData.addFriend(friendInput).then(success => {
                  if (success) { showToast("Arkadaş eklendi!", "success"); setShowAddFriend(false); setFriendInput(""); }
                });
              }} className="interactive-button" style={{ padding: '8px 16px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '4px' }}>Ekle</button>
            </div>
          </Modal>
        )
      }

      {/* SETTINGS PANELS */}
      <SettingsPanel
        show={showSettings}
        onClose={() => setShowSettings(false)}
        authState={authState}
        onProfileUpdate={updateUser}
        theme={theme}
        setTheme={setTheme}
        colors={colors}
        onLogout={doLogout}
        inputDevices={inputDevices}
        outputDevices={outputDevices}
        selectedInputId={selectedInputId}
        setSelectedInputId={setSelectedInputId}
        selectedOutputId={selectedOutputId}
        setSelectedOutputId={setSelectedOutputId}
        audioSettings={audioSettings}
        setAudioSettings={setAudioSettings}
      />

      {
        showServerSettings && (
          <ServerSettings
            server={serverData.selectedServer}
            onClose={() => setShowServerSettings(false)}
            authState={authState}
            colors={colors}
          />
        )
      }

      {/* CONTEXT MENUS */}
      <ServerContextMenu
        contextMenu={contextMenu}
        onDelete={serverData.handleLeaveServer}
      />

      <UserContextMenu
        contextMenu={userContextMenu}
        onAddFriend={(u) => serverData.addFriend(u.username + "#" + (u.discriminator || "0000"))}
        onBlock={serverData.blockUser}
        onCopyId={(id) => { navigator.clipboard.writeText(id); setUserContextMenu(null); }}
        // NEW PROPS FOR VOLUME
        onMute={handleRemoteMute}
        onVolumeChange={handleRemoteVolume}
        volume={userContextMenu?.user && webrtc.remoteAudioRefs.current[userContextMenu.user.uuid || userContextMenu.user.username]?.[0]?.volume}
        isMuted={userContextMenu?.user && webrtc.remoteAudioRefs.current[userContextMenu.user.uuid || userContextMenu.user.username]?.[0]?.muted}
      />

      <MessageContextMenu
        contextMenu={chat.messageContextMenu}
        currentUser={authState.user}
        onDelete={chat.handleDeleteMessage}
        onEdit={chat.startEditing}
      />

      {/* Persistent Screen Share Overlay */}
      {
        webrtc.isScreenSharing && webrtc.screenStreamRef.current && (serverData.selectedChannel?.type !== 'voice') && (
          <StreamOverlay
            stream={webrtc.screenStreamRef.current}
            label="Ekranın Paylaşılıyor"
            onStop={webrtc.stopScreenShare}
          />
        )
      }

      {/* TOAST NOTIFICATIONS */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

    </div >
  )
}

export default App
