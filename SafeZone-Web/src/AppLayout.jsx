import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuthContext } from './contexts/AuthContext';
import { useUIContext } from './contexts/UIContext';
import { useServerContext } from './contexts/ServerContext';
import { useChatContext } from './contexts/ChatContext';
import { useVoiceContext } from './contexts/VoiceContext';
import { useLobbyContext } from './contexts/LobbyContext';

import ServerSidebar from './components/ServerSidebar';
import ChannelList from './components/ChannelList';
import ChatArea from './components/ChatArea';
import MemberList from './components/MemberList';
import VoiceRoom from './components/VoiceRoom';
import FriendsDashboard from './components/FriendsDashboard';
import ServerSettings from './components/ServerSettings';
import SettingsPanel from './components/SettingsPanel';
import AdminDashboard from './components/AdminDashboard';
import CommandPalette from './components/CommandPalette';
import StreamOverlay from './components/StreamOverlay';
import Modal from './components/Modal';
import UpdateNotifier from './components/UpdateNotifier';
import { ServerContextMenu, UserContextMenu, MessageContextMenu, ChannelContextMenu } from './components/ContextMenus';
import ToastContainer from './components/common/Toast';
import { getUrl } from './utils/api';

const MemoChannelList = React.memo(ChannelList);
const MemoChatArea = React.memo(ChatArea);
const MemoMemberList = React.memo(MemberList);
const MemoServerSidebar = React.memo(ServerSidebar);
const MemoVoiceRoom = React.memo(VoiceRoom);

const AppLayout = () => {
    // --- Contexts ---
    const {
        authState, buildType, adminView, setAdminView,
        handleLogout: hookLogout, updateUser,
    } = useAuthContext();

    const {
        colors, theme, setTheme, toasts, removeToast, unread,
        showCommandPalette, setShowCommandPalette,
        inputDevices, outputDevices,
        selectedInputId, setSelectedInputId,
        selectedOutputId, setSelectedOutputId,
        audioSettings, setAudioSettings,
        keybinds, setKeybind, clearKeybind, isPTTMode, setIsPTTMode, getFriendlyName,
    } = useUIContext();

    const serverData = useServerContext();
    const chat = useChatContext();
    const webrtc = useVoiceContext();
    const lobby = useLobbyContext();

    // --- Local UI state (only layout-level concerns remain here) ---
    const [showCreateServer, setShowCreateServer] = useState(false);
    const [showJoinServer, setShowJoinServer] = useState(false);
    const [modalInput, setModalInput] = useState('');

    const [showChannelCreateModal, setShowChannelCreateModal] = useState(false);
    const [editingChannel, setEditingChannel] = useState(null);
    const [newChannelName, setNewChannelName] = useState('');
    const [newChannelType, setNewChannelType] = useState('text');

    const [contextMenu, setContextMenu] = useState(null);
    const [userContextMenu, setUserContextMenu] = useState(null);

    const [showSettings, setShowSettings] = useState(false);
    const [showServerSettings, setShowServerSettings] = useState(false);

    const [channelListWidth, setChannelListWidth] = useState(240);
    const [memberListWidth] = useState(240);
    const [isResizing, setIsResizing] = useState(null);
    const resizeStartX = useRef(0);
    const resizeStartWidth = useRef(0);

    const [showFriendsList, setShowFriendsList] = useState(false);
    const [showAddFriend, setShowAddFriend] = useState(false);
    const [friendInput, setFriendInput] = useState('');

    // --- Channel selection effect ---
    useEffect(() => {
        if (serverData.selectedChannel) {
            // Note: currentChannelId is set inside connectToChannel/fetchChannelMessages (single source of truth)
            unread.markChannelRead(serverData.selectedChannel.id);
            if (serverData.selectedChannel.type === 'voice') {
                const userPerms = serverData.selectedServer?.my_permissions || 0;
                const isOwner = serverData.selectedServer?.owner_id === authState.user?.id;
                const isAdmin = (userPerms & 8) === 8;
                const canSpeakPerm = (userPerms & 2048) === 2048;
                const hasSpeak = isOwner || isAdmin || canSpeakPerm;
                
                webrtc.connectToRoom(serverData.selectedChannel, hasSpeak);
            } else {
                chat.connectToChannel(serverData.selectedChannel);
                chat.fetchChannelMessages(serverData.selectedChannel.id);
            }
        }
    }, [serverData.selectedChannel]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Helpers ---
    const doLogout = useCallback(() => {
        webrtc.disconnectVoice();
        hookLogout();
    }, [webrtc, hookLogout]);

    const handleResizeStart = useCallback((e, panel) => {
        e.preventDefault();
        setIsResizing(panel);
        resizeStartX.current = e.clientX;
        resizeStartWidth.current = panel === 'channel' ? channelListWidth : memberListWidth;
    }, [channelListWidth, memberListWidth]);

    const handleResizeMove = useCallback((e) => {
        if (!isResizing) return;
        const delta = e.clientX - resizeStartX.current;
        if (isResizing === 'channel') setChannelListWidth(Math.max(180, Math.min(600, resizeStartWidth.current + delta)));
    }, [isResizing]);

    const handleResizeEnd = useCallback(() => setIsResizing(null), []);

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);
            return () => {
                document.removeEventListener('mousemove', handleResizeMove);
                document.removeEventListener('mouseup', handleResizeEnd);
            };
        }
    }, [isResizing, handleResizeMove, handleResizeEnd]);

    const handleServerRightClick = useCallback((e, server) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, serverId: server.id });
    }, []);

    const handleUserContextMenu = useCallback((e, user) => {
        e.preventDefault();
        e.stopPropagation();
        setUserContextMenu({ x: e.clientX, y: e.clientY, user });
    }, []);

    const handleRemoteVolume = useCallback((userId, vol) => {
        const pc = webrtc.peerConnections.current?.[userId];
        if (pc && pc._gainNode) { pc._gainNode.gain.value = vol; vol = 1.0; }
        if (!webrtc.remoteAudioRefs.current) return;
        const safeVol = Math.max(0, Math.min(1, vol));
        const audios = webrtc.remoteAudioRefs.current[userId];
        if (Array.isArray(audios)) audios.forEach(a => { if (a) a.volume = safeVol; });
        else if (audios) audios.volume = safeVol;
    }, [webrtc]);

    const handleRemoteMute = useCallback((userId) => {
        if (!webrtc.remoteAudioRefs.current) return;
        const audios = webrtc.remoteAudioRefs.current[userId];
        const isMuted = Array.isArray(audios) ? audios[0]?.muted : audios?.muted;
        if (Array.isArray(audios)) audios.forEach(a => { if (a) a.muted = !isMuted; });
        else if (audios) audios.muted = !isMuted;
        setUserContextMenu(prev => ({ ...prev }));
    }, [webrtc]);

    const handleShareServer = useCallback((serverId) => {
        const srv = serverData.myServers.find(s => s.id === serverId);
        if (srv?.invite_code) {
            navigator.clipboard.writeText(srv.invite_code);
        }
        setContextMenu(null);
    }, [serverData.myServers]);

    useEffect(() => { const c = () => setContextMenu(null); if (contextMenu) document.addEventListener('click', c); return () => document.removeEventListener('click', c); }, [contextMenu]);
    useEffect(() => { const c = () => setUserContextMenu(null); if (userContextMenu) document.addEventListener('click', c); return () => document.removeEventListener('click', c); }, [userContextMenu]);

    // --- Admin View ---
    if (authState.user?.is_sysadmin && adminView && buildType === 'admin') {
        return (
            <AdminDashboard
                authState={authState}
                onLogout={doLogout}
                colors={colors}
                onJoinServer={(server) => { setAdminView(false); if (server) serverData.selectServer(server); }}
                onSwitchToClient={() => setAdminView(false)}
            />
        );
    }

    // --- Main Layout ---
    return (
        <div style={{ display: 'flex', flexDirection: 'row', width: '100vw', height: '100vh', background: `linear-gradient(135deg, ${colors.background} 0%, ${colors.sidebar} 100%)`, color: colors.text, overflow: 'hidden' }}>

            {/* SIDEBAR */}
            <MemoServerSidebar
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
            <MemoChannelList
                colors={colors}
                width={channelListWidth}
                showFriendsList={showFriendsList}
                friendRequests={serverData.friendRequests.incoming || []}
                friends={serverData.friends}
                onlineUserIds={lobby.onlineUserIds}
                userStatuses={lobby.userStatuses}
                handleRespondRequest={(username, action) => serverData.respondFriendRequest(username, action)}
                setShowAddFriend={setShowAddFriend}
                handleRemoveFriend={(username) => { const f = serverData.friends.find(fr => fr.username === username); if (f) serverData.removeFriend(f.id); }}
                selectedServer={serverData.selectedServer}
                serverMembers={serverData.serverMembers}
                setShowChannelCreateModal={setShowChannelCreateModal}
                unreadChannels={unread.unreadChannels}
                unreadDMs={unread.unreadDMs}
                handleChannelClick={(ch) => { serverData.setSelectedChannel(ch); unread.markChannelRead(ch.id); }}
                handleStartDM={(friend) => { lobby.startDM(friend); unread.markDMRead(friend.username); }}
                setContextMenu={setContextMenu}
                handleUserContextMenu={handleUserContextMenu}
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
                canSpeak={webrtc.canSpeak}
                handleServerSettings={() => setShowServerSettings(true)}
            >
                <div onMouseDown={(e) => handleResizeStart(e, 'channel')} style={{ position: 'absolute', top: 0, right: -2, width: '4px', height: '100%', cursor: 'ew-resize', zIndex: 10 }} />
            </MemoChannelList>

            {/* MAIN AREA */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'transparent', order: 3 }}>
                {/* Header */}
                <div style={{ padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(22,22,22,0.6)', backdropFilter: 'blur(20px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '24px' }}>{lobby.selectedDM ? '@' : (serverData.selectedChannel?.type === 'voice' ? '🔊' : '#')}</span>
                        <span style={{ fontWeight: 'bold' }}>{lobby.selectedDM ? lobby.selectedDM.username : (serverData.selectedChannel?.name || 'Hoşgeldin')}</span>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {(serverData.selectedChannel?.type === 'text' || lobby.selectedDM) ? (
                        <>
                            <MemoChatArea
                                colors={colors}
                                selectedChannel={serverData.selectedChannel}
                                selectedDM={lobby.selectedDM}
                                messages={lobby.selectedDM ? lobby.dmHistory : chat.messages}
                                dmHistory={lobby.dmHistory}
                                currentUser={authState.user}
                                inputText={chat.inputText}
                                setInputText={chat.setInputText}
                                onSendMessage={chat.sendChatMessage}
                                onSendDM={() => { lobby.sendDM(chat.inputText); chat.setInputText(''); }}
                                handleTyping={lobby.selectedDM ? lobby.sendDMTyping : chat.handleTyping}
                                typingUsers={lobby.selectedDM ? (lobby.dmTypingUser ? new Set([lobby.dmTypingUser]) : new Set()) : chat.typingUsers}
                                attachment={chat.attachment}
                                setAttachment={chat.setAttachment}
                                isUploading={chat.isUploading}
                                handleFileSelect={chat.handleFileSelect}
                                handleMessageContextMenu={chat.handleMessageContextMenu}
                                editingMessageId={chat.editingMessageId}
                                setEditingMessageId={chat.setEditingMessageId}
                                editText={chat.editText}
                                setEditText={chat.setEditText}
                                submitEdit={lobby.selectedDM
                                    ? () => lobby.editDM(chat.editingMessageId, chat.editText).then(() => chat.setEditingMessageId(null))
                                    : chat.submitEdit}
                                handleDeleteMessage={lobby.selectedDM ? lobby.deleteDM : chat.handleDeleteMessage}
                                onlineMembers={serverData.serverMembers || []}
                                serverMembers={serverData.serverMembers || []}
                                loadMoreMessages={lobby.selectedDM ? lobby.loadMoreDMs : chat.loadMoreMessages}
                                hasMore={lobby.selectedDM ? lobby.dmHasMore : chat.hasMore}
                                isLoadingMore={lobby.selectedDM ? lobby.dmIsLoadingMore : chat.isLoadingMore}
                                replyingTo={chat.replyingTo}
                                setReplyingTo={chat.setReplyingTo}
                                activeEmojiPickerId={chat.activeEmojiPickerId}
                                myPermissions={serverData.selectedServer?.my_permissions}
                                setActiveEmojiPickerId={chat.setActiveEmojiPickerId}
                                emojiPickerPosition={chat.emojiPickerPosition}
                                setEmojiPickerPosition={chat.setEmojiPickerPosition}
                                authToken={authState.token}
                                setMessages={lobby.selectedDM ? lobby.setDmHistory : chat.setMessages}
                                serverRoles={serverData.serverRoles || []}
                                selectedServer={serverData.selectedServer}
                                onRoleToggled={() => serverData.fetchMembers(serverData.selectedServer?.id)}
                            />

                            {serverData.selectedChannel?.type === 'text' && !lobby.selectedDM && (
                                <MemoMemberList
                                    members={serverData.serverMembers}
                                    onlineUserIds={lobby.onlineUserIds}
                                    userStatuses={lobby.userStatuses}
                                    colors={colors}
                                    width={memberListWidth}
                                    onResizeStart={handleResizeStart}
                                    handleUserContextMenu={handleUserContextMenu}
                                    serverRoles={serverData.serverRoles || []}
                                    currentUser={authState.user}
                                    selectedServer={serverData.selectedServer}
                                    authToken={authState.token}
                                    onRoleToggled={() => serverData.fetchMembers(serverData.selectedServer?.id)}
                                />
                            )}
                        </>
                    ) : (serverData.selectedChannel?.type === 'voice') ? (
                        <MemoVoiceRoom
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
                            handleStartDM={(friend) => { lobby.startDM(friend); unread.markDMRead(friend.username); }}
                        />
                    )}
                </div>
            </div>

            {/* --- GLOBAL PERSISTENT AUDIO --- */}
            {webrtc.connectedUsers.map(user => (
                <audio
                    key={user.uuid || user.username}
                    ref={el => {
                        if (!webrtc.remoteAudioRefs?.current) return;
                        const key = user.uuid || user.username;
                        if (!webrtc.remoteAudioRefs.current[key]) webrtc.remoteAudioRefs.current[key] = [];
                        webrtc.remoteAudioRefs.current[key][0] = el;
                        if (el && webrtc.remoteStreams && webrtc.remoteStreams[key]) {
                            if (el.srcObject !== webrtc.remoteStreams[key]) el.srcObject = webrtc.remoteStreams[key];
                        }
                    }}
                    autoPlay
                    playsInline
                    onPlay={(e) => {
                        if (selectedOutputId && selectedOutputId !== 'default' && e.target.setSinkId) {
                            e.target.setSinkId(selectedOutputId).catch(console.error);
                        }
                    }}
                />
            ))}

            {/* MODALS */}
            {showCreateServer && (
                <Modal title="Sunucu Oluştur" onClose={() => { setShowCreateServer(false); setModalInput(''); }} colors={colors}>
                    <p style={{ color: '#aaa', marginBottom: '16px' }}>Yeni sunucunun adı ne olsun?</p>
                    <input autoFocus type="text" placeholder="Sunucu Adı" value={modalInput} onChange={e => setModalInput(e.target.value)} onKeyDown={async e => { if (e.key === 'Enter') { const ok = await serverData.handleCreateServer(modalInput); if (ok) { setShowCreateServer(false); setModalInput(''); } } }} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#fff' }} />
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                        <button onClick={() => { setShowCreateServer(false); setModalInput(''); }} style={{ padding: '8px 16px', background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer' }}>İptal</button>
                        <button onClick={async () => { const ok = await serverData.handleCreateServer(modalInput); if (ok) { setShowCreateServer(false); setModalInput(''); } }} style={{ padding: '8px 16px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Oluştur</button>
                    </div>
                </Modal>
            )}

            {showJoinServer && (
                <Modal title="Sunucuya Katıl" onClose={() => { setShowJoinServer(false); setModalInput(''); }} colors={colors}>
                    <p style={{ color: '#aaa', marginBottom: '16px' }}>Arkadaşının attığı davet kodunu gir.</p>
                    <input autoFocus type="text" placeholder="Davet Kodu" value={modalInput} onChange={e => setModalInput(e.target.value)} onKeyDown={async e => { if (e.key === 'Enter') { const ok = await serverData.handleJoinServer(modalInput); if (ok) { setShowJoinServer(false); setModalInput(''); } } }} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#fff' }} />
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                        <button onClick={() => { setShowJoinServer(false); setModalInput(''); }} style={{ padding: '8px 16px', background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer' }}>İptal</button>
                        <button onClick={async () => { const ok = await serverData.handleJoinServer(modalInput); if (ok) { setShowJoinServer(false); setModalInput(''); } }} style={{ padding: '8px 16px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Katıl</button>
                    </div>
                </Modal>
            )}

            {showChannelCreateModal && (
                <Modal title="Kanal Oluştur" onClose={() => setShowChannelCreateModal(false)} colors={colors}>
                    <input autoFocus type="text" placeholder="Kanal ismi" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} onKeyDown={async e => { if (e.key === 'Enter') { const ok = await serverData.handleCreateChannel(serverData.selectedServer.id, newChannelName, newChannelType); if (ok) { setShowChannelCreateModal(false); setNewChannelName(''); } } }} style={{ width: '100%', padding: '10px', marginBottom: '16px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#fff' }} />
                    <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
                        <button onClick={() => setNewChannelType('text')} style={{ flex: 1, padding: '10px', background: newChannelType === 'text' ? colors.accent : '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>💬 Yazılı</button>
                        <button onClick={() => setNewChannelType('voice')} style={{ flex: 1, padding: '10px', background: newChannelType === 'voice' ? colors.accent : '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🔊 Sesli</button>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setShowChannelCreateModal(false); setNewChannelName(''); }} style={{ padding: '8px 16px', background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer' }}>İptal</button>
                        <button onClick={async () => { const ok = await serverData.handleCreateChannel(serverData.selectedServer.id, newChannelName, newChannelType); if (ok) { setShowChannelCreateModal(false); setNewChannelName(''); } }} style={{ padding: '8px 16px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Oluştur</button>
                    </div>
                </Modal>
            )}

            {showAddFriend && (
                <Modal title="Arkadaş Ekle" onClose={() => { setShowAddFriend(false); setFriendInput(''); }} colors={colors}>
                    <p style={{ color: '#aaa', marginBottom: '16px' }}>Örnek: admin#1234</p>
                    <input autoFocus type="text" placeholder="username#1234" value={friendInput} onChange={e => setFriendInput(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#fff' }} />
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                        <button onClick={() => { setShowAddFriend(false); setFriendInput(''); }} style={{ padding: '8px 16px', background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer' }}>İptal</button>
                        <button onClick={() => { serverData.addFriend(friendInput).then(ok => { if (ok) { setShowAddFriend(false); setFriendInput(''); } }); }} style={{ padding: '8px 16px', background: colors.accent, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Ekle</button>
                    </div>
                </Modal>
            )}

            {/* SETTINGS */}
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
                keybinds={keybinds}
                setKeybind={setKeybind}
                clearKeybind={clearKeybind}
                isPTTMode={isPTTMode}
                setIsPTTMode={setIsPTTMode}
                getFriendlyName={getFriendlyName}
            />

            {showServerSettings && (
                <ServerSettings
                    server={serverData.selectedServer}
                    onClose={() => setShowServerSettings(false)}
                    authState={authState}
                    colors={colors}
                    onRolesChanged={() => { serverData.fetchRoles(serverData.selectedServer?.id); serverData.fetchMembers(serverData.selectedServer?.id); }}
                />
            )}

            {/* CONTEXT MENUS */}
            {contextMenu?.serverId && (
                <ServerContextMenu
                    contextMenu={contextMenu}
                    onDelete={(id) => { serverData.handleDeleteServer(id); setContextMenu(null); }}
                    onLeave={(id) => { serverData.handleLeaveServer(id); setContextMenu(null); }}
                    onShare={handleShareServer}
                    isOwner={serverData.myServers.find(s => s.id === contextMenu.serverId)?.owner_id === authState.user?.id || authState.user?.is_sysadmin}
                />
            )}

            {contextMenu?.channelId && (
                <ChannelContextMenu
                    contextMenu={contextMenu}
                    onDelete={(id) => { serverData.handleDeleteChannel(id); setContextMenu(null); }}
                    onEdit={(channelId, channelObj) => { setEditingChannel({ id: channelId, name: channelObj?.name || '' }); setContextMenu(null); }}
                    myPermissions={serverData.selectedServer?.my_permissions}
                />
            )}

            <UserContextMenu
                contextMenu={userContextMenu}
                onAddFriend={(u) => serverData.addFriend(u.username + '#' + (u.discriminator || '0000'))}
                onBlock={serverData.blockUser}
                onCopyId={(id) => { navigator.clipboard.writeText(id); setUserContextMenu(null); }}
                onMute={handleRemoteMute}
                onVolumeChange={handleRemoteVolume}
                volume={userContextMenu?.user && webrtc.remoteAudioRefs.current[userContextMenu.user.uuid || userContextMenu.user.username]?.[0]?.volume}
                isMuted={userContextMenu?.user && webrtc.remoteAudioRefs.current[userContextMenu.user.uuid || userContextMenu.user.username]?.[0]?.muted}
                myPermissions={serverData.selectedServer?.my_permissions}
                onKick={(u) => { serverData.kickMember(u.username); setUserContextMenu(null); }}
                onBan={(u) => { serverData.banMember(u.username); setUserContextMenu(null); }}
                onAssignRole={(u, roleId) => serverData.assignRole(u, roleId)}
                onUnassignRole={(u, roleId) => serverData.unassignRole(u, roleId)}
                serverRoles={serverData.serverRoles}
            />

            <MessageContextMenu
                contextMenu={chat.messageContextMenu}
                currentUser={authState.user}
                myPermissions={serverData.selectedServer?.my_permissions}
                onDelete={lobby.selectedDM ? lobby.deleteDM : chat.handleDeleteMessage}
                onEdit={(msg) => {
                    if (lobby.selectedDM) {
                        chat.setEditingMessageId(msg.id);
                        chat.setEditText(msg.content || msg.text || '');
                        chat.setMessageContextMenu(null);
                    } else {
                        chat.startEditing(msg);
                    }
                }}
                onReply={(msg) => { chat.setReplyingTo({ id: msg.id, sender: msg.sender, text: msg.text }); setTimeout(() => chat.setMessageContextMenu(null), 0); }}
                onReactClick={(context) => { chat.setActiveEmojiPickerId(context.msg.id); chat.setEmojiPickerPosition({ x: context.x, y: context.y }); setTimeout(() => chat.setMessageContextMenu(null), 0); }}
                onPin={async (msg) => {
                    const isPinned = msg.is_pinned;
                    const channelId = serverData.selectedChannel?.id;
                    const token = authState.token;
                    const endpoint = isPinned ? `/message/${msg.id}/unpin?token=${token}` : `/message/${msg.id}/pin?token=${token}&channel_id=${channelId}`;
                    try {
                        const res = await fetch(getUrl(endpoint), { method: 'POST' });
                        const data = await res.json();
                        if (data.status === 'success') {
                            chat.setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_pinned: !isPinned } : m));
                        }
                    } catch (e) { console.error(e); }
                    setTimeout(() => chat.setMessageContextMenu(null), 0);
                }}
            />

            {/* Screen Share Overlay */}
            {webrtc.isScreenSharing && webrtc.screenStreamRef.current && serverData.selectedChannel?.type !== 'voice' && (
                <StreamOverlay stream={webrtc.screenStreamRef.current} label="Ekranın Paylaşılıyor" onStop={webrtc.stopScreenShare} />
            )}

            {/* Command Palette */}
            <CommandPalette
                open={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
                servers={serverData.myServers || []}
                friends={[]}
                colors={colors}
                onSelectChannel={(server, channel) => { serverData.setSelectedServer(server); serverData.setSelectedChannel(channel); }}
                onSelectFriend={() => { }}
            />

            {/* Toast & Updater */}
            <UpdateNotifier colors={colors} />
            <ToastContainer toasts={toasts} onRemove={removeToast} />

        </div>
    );
};

export default AppLayout;
