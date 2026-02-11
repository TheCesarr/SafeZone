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
import { ServerContextMenu, UserContextMenu } from './components/ContextMenus';
import Modal from './components/Modal';
import { getTheme, getPaletteName } from './utils/themes';
import StreamOverlay from './components/StreamOverlay';
import MemberList from './components/MemberList';
import { useToast } from './hooks/useToast';
import ToastContainer from './components/common/Toast';

// NEW HOOKS
import { useAuth } from './hooks/useAuth';
import { useServerData } from './hooks/useServerData';
import { useWebRTC } from './hooks/useWebRTC';
import { useChat } from './hooks/useChat';
import { useLobby } from './hooks/useLobby';

function App() {
  // --- 1. CONFIG & AUTH ---
  const [serverIp, setServerIp] = useState(localStorage.getItem('safezone_server_ip') || window.location.hostname || 'localhost')
  const [isServerSet, setIsServerSet] = useState(!!localStorage.getItem('safezone_server_ip'))

  // Toast Hook
  const { toasts, showToast, removeToast } = useToast();

  // Auth Hook
  const { authState, authMode, setAuthMode, authError, setAuthError, handleLogin, handleRegister, handleResetPassword, handleLogout: hookLogout, isLoading: authLoading } = useAuth();
  const [authInput, setAuthInput] = useState({ username: '', password: '', display_name: '', recovery_pin: '' });

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

  const lobby = useLobby(authState, uuid, serverData.fetchServers); // Pass fetchServers to lobby for updates

  // Chat & Voice Hooks (Interconnected)
  const chat = useChat(authState, uuid, chatWs, roomWs);
  const webrtc = useWebRTC(authState, uuid, roomWs, chat.handleIncomingMessage, selectedInputId, selectedOutputId, audioSettings);

  // --- 3. UI STATE (Specific to App Layout) ---
  const [showCreateServer, setShowCreateServer] = useState(false)
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

  // Theme Background
  useEffect(() => {
    document.body.style.backgroundColor = colors.background;
    document.body.style.color = colors.text;
  }, [theme, colors]);

  // Auth Sync
  useEffect(() => {
    if (authState.token) {
      setIsServerSet(true);
      // Hooks handle data fetching automatically on token change
    }
  }, [authState.token]);

  // Audio Device Enumeration
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request permission primarily to get labels
        // We only request if we are going to join a voice channel or if user is in settings, 
        // but for simplicity we can try to enumerate. 
        // Without permission, labels might be empty.
        const devices = await navigator.mediaDevices.enumerateDevices();

        const inputs = devices.filter(d => d.kind === 'audioinput');
        const outputs = devices.filter(d => d.kind === 'audiooutput');

        setInputDevices(inputs);
        setOutputDevices(outputs);

        // Set defaults if not set
        if (selectedInputId === 'default' && inputs.length > 0 && !inputs.find(d => d.deviceId === 'default')) {
          setSelectedInputId(inputs[0].deviceId);
        }
        if (selectedOutputId === 'default' && outputs.length > 0 && !outputs.find(d => d.deviceId === 'default')) {
          setSelectedOutputId(outputs[0].deviceId);
        }

      } catch (e) {
        console.error("Error enumerating devices:", e);
      }
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
    if (authMode === 'login') handleLogin(authInput.username, authInput.password);
    else if (authMode === 'register') handleRegister(authInput.username, authInput.password, authInput.display_name, authInput.recovery_pin);
    else if (authMode === 'reset') handleResetPassword(authInput.username, authInput.recovery_pin, authInput.password);
    // Reset logic handled in hook? No, added simplified.
  }

  const doLogout = () => {
    webrtc.disconnectVoice();
    hookLogout();
  }

  const saveServerIp = () => {
    if (!serverIp) return;
    localStorage.setItem('safezone_server_ip', serverIp);
    setIsServerSet(true);
    window.location.reload(); // Simple reload to re-init hooks with new IP if needed
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

  // Close menus
  useEffect(() => { const c = () => setContextMenu(null); if (contextMenu) document.addEventListener('click', c); return () => document.removeEventListener('click', c); }, [contextMenu]);
  useEffect(() => { const c = () => setUserContextMenu(null); if (userContextMenu) document.addEventListener('click', c); return () => document.removeEventListener('click', c); }, [userContextMenu]);


  // --- 5. RENDER (The big block) ---
  if (!isServerSet) {
    return (
      <div style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=2670&auto=format&fit=crop")', backgroundSize: 'cover', backgroundPosition: 'center', height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Inter", sans-serif' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(5px)' }}></div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 style={{ fontSize: '48px', fontWeight: '900', color: '#fff', marginBottom: '30px', textShadow: '0 0 20px rgba(88, 101, 242, 0.8)' }}>SafeZone</h1>
          <div style={{ width: '480px', padding: '32px', background: colors.card, borderRadius: '5px', boxShadow: '0 2px 10px 0 rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <h2 style={{ color: colors.text, marginBottom: '8px', fontSize: '24px', fontWeight: 'bold' }}>Sunucuya Bağlan</h2>
            <input type="text" value={serverIp} onChange={e => setServerIp(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '3px', border: '1px solid #333', background: colors.sidebar, color: colors.text }} />
            <button onClick={saveServerIp} style={{ width: '100%', padding: '10px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '3px', fontWeight: 'bold', cursor: 'pointer' }}>Bağlan</button>
          </div>
        </div>
      </div>
    )
  }

  if (!authState.token) {
    return (
      <div style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=2670&auto=format&fit=crop")', backgroundSize: 'cover', backgroundPosition: 'center', height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Inter", sans-serif' }}>
        <div style={{ width: '480px', padding: '32px', background: colors.card, borderRadius: '5px' }}>
          <h2 style={{ color: colors.text, marginBottom: '20px' }}>{authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}</h2>
          {authError && <div style={{ color: colors.error, marginBottom: 10 }}>{authError}</div>}
          {authMode === 'reset' && (
            <>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>KULLANICI ADI</label>
                <input type="text" value={authInput.username} onChange={e => setAuthInput({ ...authInput, username: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
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

          {authMode !== 'reset' && (
            <>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>KULLANICI ADI</label>
                <input type="text" value={authInput.username} onChange={e => setAuthInput({ ...authInput, username: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
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
                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>GÖRÜNEN İSİM</label>
                <input type="text" value={authInput.display_name} onChange={e => setAuthInput({ ...authInput, display_name: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', color: '#b9bbbe', fontSize: 12, fontWeight: 'bold', marginBottom: 5 }}>PIN (4 Haneli)</label>
                <input type="text" maxLength="4" value={authInput.recovery_pin} onChange={e => setAuthInput({ ...authInput, recovery_pin: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 3, border: '1px solid #202225', background: '#202225', color: '#fff' }} />
              </div>
            </>
          )}

          <button onClick={handleAuthSubmit} style={{ width: '100%', padding: 10, background: colors.accent, color: '#fff', border: 'none', borderRadius: 3, fontWeight: 'bold', cursor: 'pointer' }}>
            {authMode === 'login' ? 'Giriş' : authMode === 'register' ? 'Kayıt Ol' : 'Şifreyi Sıfırla'}
          </button>
          <div style={{ marginTop: 10, fontSize: 14, color: '#72767d' }}>
            {authMode === 'login' ?
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                  <span style={{ fontSize: 14, color: '#72767d' }}>Hesabın yok mu? <span onClick={() => setAuthMode('register')} style={{ color: colors.accent, cursor: 'pointer' }}>Kaydol</span></span>
                  <span onClick={() => setAuthMode('reset')} style={{ fontSize: 14, color: colors.accent, cursor: 'pointer' }}>Şifremi Unuttum</span>
                </div>
              </> :
              authMode === 'register' ?
                <>Zaten hesabın var mı? <span onClick={() => setAuthMode('login')} style={{ color: colors.accent, cursor: 'pointer' }}>Giriş Yap</span></> :
                <>Hatırladın mı? <span onClick={() => setAuthMode('login')} style={{ color: colors.accent, cursor: 'pointer' }}>Giriş Yap</span></>
            }
          </div>
          <div style={{ marginTop: 20, textAlign: 'center', borderTop: '1px solid #2f3136', paddingTop: 10 }}>
            <span onClick={() => setIsServerSet(false)} style={{ fontSize: 12, color: '#72767d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
              ⚙️ Sunucu Ayarları
            </span>
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
        onServerClick={(s) => { serverData.selectServer(s); setShowFriendsList(false); lobby.setSelectedDM(null); }}
        onFriendsClick={() => { setShowFriendsList(true); serverData.selectServer(null); lobby.setSelectedDM(null); }}
        onCreateServerClick={() => setShowCreateServer(true)}
        onJoinServerClick={() => setShowJoinServer(true)}
        onSettingsClick={() => setShowSettings(true)}
        handleServerRightClick={handleServerRightClick}
        colors={colors}
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
          const req = serverData.friendRequests.incoming.find(r => r.username === username);
          if (req) {
            serverData.respondFriendRequest(req.id, action);
          }
        }}
        setShowAddFriend={setShowAddFriend}
        handleStartDM={lobby.startDM}
        handleRemoveFriend={(username) => {
          const f = serverData.friends.find(fr => fr.username === username);
          if (f) serverData.removeFriend(f.id);
        }}
        selectedServer={serverData.selectedServer}
        serverMembers={serverData.serverMembers}
        setShowChannelCreateModal={setShowChannelCreateModal}
        handleChannelClick={(ch) => serverData.setSelectedChannel(ch)} // Effect handles connection
        setContextMenu={setContextMenu}
        selectedChannel={serverData.selectedChannel}
        activeVoiceChannel={webrtc.activeVoiceChannel}
        roomDetails={lobby.roomDetails}
        speakingUsers={webrtc.speakingUsers}
        voiceStates={webrtc.voiceStates}
        authState={authState}
        isMuted={webrtc.isMuted}
        isDeafened={webrtc.isDeafened}
        isNoiseCancelled={audioSettings.noiseSuppression}
        ping={lobby.ping}
        onDisconnect={webrtc.disconnectVoice}
        onToggleMute={webrtc.toggleMute}
        onToggleDeafen={webrtc.toggleDeafen}
        onToggleNoiseCancellation={() => setAudioSettings(prev => ({ ...prev, noiseSuppression: !prev.noiseSuppression }))}
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
            />
          ) : (
            <FriendsDashboard
              colors={colors}
              friends={serverData.friends}
              requests={serverData.friendRequests}
              onlineUserIds={lobby.onlineUserIds}
              onAddFriend={() => setShowAddFriend(true)}
            />
          )}
        </div>
      </div>

      {/* MODALS */}
      {showCreateServer && (
        <Modal title="Sunucu Oluştur" onClose={() => { setShowCreateServer(false); setModalInput(""); }} colors={colors}>
          <p style={{ color: '#aaa', marginBottom: '16px' }}>Yeni sunucunun adı ne olsun?</p>
          <input autoFocus type="text" placeholder="Sunucu Adı" value={modalInput} onChange={e => setModalInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSimpleCreateServer()} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#fff' }} />
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button onClick={() => { setShowCreateServer(false); setModalInput(""); }} className="interactive-button" style={{ padding: '8px 16px', background: 'transparent', color: '#aaa', border: 'none' }}>İptal</button>
            <button onClick={onSimpleCreateServer} className="interactive-button" style={{ padding: '8px 16px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '4px' }}>Oluştur</button>
          </div>
        </Modal>
      )}

      {showJoinServer && (
        <Modal title="Sunucuya Katıl" onClose={() => { setShowJoinServer(false); setModalInput(""); }} colors={colors}>
          <p style={{ color: '#aaa', marginBottom: '16px' }}>Arkadaşının attığı davet kodunu gir.</p>
          <input autoFocus type="text" placeholder="Davet Kodu" value={modalInput} onChange={e => setModalInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSimpleJoinServer()} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#fff' }} />
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button onClick={() => { setShowJoinServer(false); setModalInput(""); }} className="interactive-button" style={{ padding: '8px 16px', background: 'transparent', color: '#aaa', border: 'none' }}>İptal</button>
            <button onClick={onSimpleJoinServer} className="interactive-button" style={{ padding: '8px 16px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '4px' }}>Katıl</button>
          </div>
        </Modal>
      )}

      {showChannelCreateModal && (
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
      )}

      {showAddFriend && (
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
      )}

      {/* SETTINGS PANELS */}
      <SettingsPanel
        show={showSettings}
        onClose={() => setShowSettings(false)}
        authState={authState}
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

      {showServerSettings && (
        <ServerSettings
          server={serverData.selectedServer}
          onClose={() => setShowServerSettings(false)}
          authState={authState}
          colors={colors}
        />
      )}

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
      />

      {/* Persistent Screen Share Overlay */}
      {webrtc.isScreenSharing && webrtc.screenStreamRef.current && (serverData.selectedChannel?.type !== 'voice') && (
        <StreamOverlay
          stream={webrtc.screenStreamRef.current}
          label="Ekranın Paylaşılıyor"
          onStop={webrtc.stopScreenShare}
        />
      )}

      {/* TOAST NOTIFICATIONS */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

    </div>
  )
}

export default App
