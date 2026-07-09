import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, API } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';
import { SocketProvider, useSocketContext } from '../contexts/SocketContext';
import ActiveUsers from '../components/ActiveUsers';
import VersionHistory from '../components/VersionHistory';
import CollaboratorPanel from '../components/CollaboratorPanel';
import ChatPanel from '../components/ChatPanel';
import ActivityLog from '../components/ActivityLog';

// Inner component that uses socket context
function EditorInner() {
  const { id: docId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const { notify } = useNotification();
  const { socketRef, connected, emit } = useSocketContext();

  const [doc, setDoc] = useState(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [activePanel, setActivePanel] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const contentRef = useRef('');
  const titleRef = useRef('');
  const typingTimerRef = useRef(null);
  const saveTimerRef = useRef(null);
  const joinedRef = useRef(false);
  const activePanelRef = useRef(activePanel);
  useEffect(() => { activePanelRef.current = activePanel; }, [activePanel]);

  // Load document from API
  useEffect(() => {
    API.get(`/documents/${docId}`)
      .then(res => {
        const d = res.data.document;
        setDoc(d);
        setTitle(d.title);
        setContent(d.content || '');
        contentRef.current = d.content || '';
        titleRef.current = d.title;
        setLoading(false);
      })
      .catch(err => {
        notify.error(err.response?.data?.error || 'Failed to load document');
        navigate('/dashboard');
      });
  }, [docId]);

  // Set up all socket listeners once
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || loading) return;
    if (joinedRef.current) return;
    joinedRef.current = true;

    console.log('Joining document:', docId);
    socket.emit('join_document', { documentId: docId });

    const onDocumentState = ({ content: c, title: t }) => {
      setContent(c); contentRef.current = c;
      if (t) { setTitle(t); titleRef.current = t; }
    };

    const onContentUpdate = ({ content: c, title: t, userId }) => {
      if (userId === user._id) return;
      if (c !== undefined) { setContent(c); contentRef.current = c; }
      if (t !== undefined) { setTitle(t); titleRef.current = t; }
    };

    const onTitleUpdated = ({ title: t }) => {
      setTitle(t); titleRef.current = t;
    };

    const onActiveUsers = (users) => {
      setActiveUsers(users.filter(u => u.userId !== user._id));
    };

    const onUserTyping = ({ userId, username, color, isTyping }) => {
      if (userId === user._id) return;
      setTypingUsers(prev => {
        if (isTyping) return { ...prev, [userId]: { username, color } };
        const next = { ...prev }; delete next[userId]; return next;
      });
    };

    const onAutoSaved = ({ timestamp }) => {
      setLastSaved(new Date(timestamp)); setSaving(false);
    };

    const onVersionSaved = ({ message }) => {
      notify.success(message, 3000);
    };

    const onNotification = ({ message }) => {
      notify.info(message, 3000);
    };

    const onChatMessage = () => {
      if (activePanelRef.current !== 'chat') setUnreadMessages(p => p + 1);
    };

    const onError = ({ message }) => notify.error(message);

    socket.on('document_state', onDocumentState);
    socket.on('content_update', onContentUpdate);
    socket.on('title_updated', onTitleUpdated);
    socket.on('active_users', onActiveUsers);
    socket.on('user_typing', onUserTyping);
    socket.on('auto_saved', onAutoSaved);
    socket.on('version_saved', onVersionSaved);
    socket.on('notification', onNotification);
    socket.on('chat_message', onChatMessage);
    socket.on('error', onError);

    return () => {
      socket.emit('leave_document', { documentId: docId });
      socket.off('document_state', onDocumentState);
      socket.off('content_update', onContentUpdate);
      socket.off('title_updated', onTitleUpdated);
      socket.off('active_users', onActiveUsers);
      socket.off('user_typing', onUserTyping);
      socket.off('auto_saved', onAutoSaved);
      socket.off('version_saved', onVersionSaved);
      socket.off('notification', onNotification);
      socket.off('chat_message', onChatMessage);
      socket.off('error', onError);
      joinedRef.current = false;
    };
  }, [socketRef.current, loading, docId]);

  const handleContentChange = useCallback((e) => {
    const val = e.target.value;
    setContent(val); contentRef.current = val;
    socketRef.current?.emit('content_update', { documentId: docId, content: val });

    socketRef.current?.emit('typing', { documentId: docId, isTyping: true });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit('typing', { documentId: docId, isTyping: false });
    }, 1500);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving(true);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await API.put(`/documents/${docId}`, { content: val });
        setLastSaved(new Date()); setSaving(false);
      } catch { setSaving(false); }
    }, 3000);
  }, [docId]);

  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitle(val); titleRef.current = val;
    socketRef.current?.emit('content_update', { documentId: docId, title: val });
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => API.put(`/documents/${docId}`, { title: val }), 1000);
  };

  const handleSaveVersion = () => {
    const message = window.prompt('Version note (optional):', `Saved by ${user.username}`);
    if (message === null) return;
    socketRef.current?.emit('save_version', { documentId: docId, message: message || `Saved by ${user.username}` });
  };

  const handleExport = (format) => {
    const filename = (titleRef.current || 'document');
    const content = contentRef.current;
    let blob, ext;
    if (format === 'md') { blob = new Blob([content], { type: 'text/markdown' }); ext = 'md'; }
    else if (format === 'json') {
      blob = new Blob([JSON.stringify({ title: titleRef.current, content, exportedAt: new Date() }, null, 2)], { type: 'application/json' });
      ext = 'json';
    } else { blob = new Blob([content], { type: 'text/plain' }); ext = 'txt'; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${filename}.${ext}`; a.click(); URL.revokeObjectURL(a.href);
    notify.success(`Exported as .${ext}`);
  };

  const canEdit = doc?.owner?._id?.toString() === user._id?.toString() ||
    doc?.collaborators?.some(c => c.user?._id?.toString() === user._id?.toString() && c.role === 'editor');

  const typingList = Object.values(typingUsers);
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>;

  return (
    <div className="editor-layout">
      <header className="editor-header">
        <div className="editor-header-left">
          <button className="icon-btn" onClick={() => navigate('/dashboard')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <input className="title-input" value={title} onChange={handleTitleChange}
            placeholder="Untitled Document" disabled={!canEdit} />
          <div className={`save-status ${saving ? 'saving' : ''}`}>
            {saving ? <><span className="save-dot saving-dot"/><span>Saving…</span></>
              : lastSaved ? <><span className="save-dot saved-dot"/><span>Saved {lastSaved.toLocaleTimeString()}</span></>
              : <><span className="save-dot"/><span>Not saved</span></>}
          </div>
        </div>
        <div className="editor-header-center">
          <ActiveUsers users={activeUsers} />
          {typingList.length > 0 && (
            <div className="typing-indicator">
              <span className="typing-dots"><span/><span/><span/></span>
              <span>{typingList.map(u => u.username).join(', ')} {typingList.length === 1 ? 'is' : 'are'} typing</span>
            </div>
          )}
        </div>
        <div className="editor-header-right">
          <div className={`conn-badge ${connected ? 'connected' : 'disconnected'}`}>
            <span className="conn-dot"/>{connected ? 'Live' : 'Offline'}
          </div>
          <button className="icon-btn" onClick={handleSaveVersion} title="Save version">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
          </button>
          <div className="dropdown-wrapper">
            <button className="icon-btn" title="Export">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            <div className="dropdown-menu export-menu">
              <button className="dropdown-item" onClick={() => handleExport('txt')}>Export as .txt</button>
              <button className="dropdown-item" onClick={() => handleExport('md')}>Export as .md</button>
              <button className="dropdown-item" onClick={() => handleExport('json')}>Export as .json</button>
            </div>
          </div>
          <button className="icon-btn" onClick={toggleDarkMode} title="Toggle theme">
            {darkMode
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
        </div>
      </header>

      <div className="editor-body">
        <aside className="editor-sidebar">
          <nav className="sidebar-nav">
            {[
              { id: 'collaborators', label: 'Team', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
              { id: 'versions', label: 'History', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/><polyline points="12 7 12 12 15 15"/></svg> },
              { id: 'activity', label: 'Activity', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
              { id: 'chat', label: 'Chat', badge: unreadMessages, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
            ].map(({ id, label, icon, badge }) => (
              <button key={id}
                className={`sidebar-btn ${activePanel === id ? 'active' : ''}`}
                onClick={() => { setActivePanel(activePanel === id ? null : id); if (id === 'chat') setUnreadMessages(0); }}
                title={label}>
                {icon}<span>{label}</span>
                {badge > 0 && <span className="sidebar-badge">{badge}</span>}
              </button>
            ))}
          </nav>
        </aside>

        {activePanel && (
          <div className="side-panel">
            <div className="side-panel-header">
              <h3>{{ collaborators: 'Team', versions: 'Version History', activity: 'Activity Log', chat: 'Chat' }[activePanel]}</h3>
              <button className="icon-btn sm" onClick={() => setActivePanel(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="side-panel-content">
              {activePanel === 'versions' && (
                <VersionHistory docId={docId} onRestore={(c) => {
                  setContent(c); contentRef.current = c;
                  socketRef.current?.emit('content_update', { documentId: docId, content: c });
                  notify.success('Version restored');
                }} />
              )}
              {activePanel === 'collaborators' && (
                <CollaboratorPanel doc={doc} onUpdate={setDoc} currentUser={user} />
              )}
              {activePanel === 'activity' && <ActivityLog docId={docId} />}
              {activePanel === 'chat' && (
                <ChatPanel docId={docId} emit={emit} user={user} />
              )}
            </div>
          </div>
        )}

        <main className="editor-main">
          <div className="editor-page">
            <textarea className="editor-textarea" value={content}
              onChange={handleContentChange}
              placeholder="Start writing… your changes sync in real-time."
              disabled={!canEdit} spellCheck />
          </div>
          <div className="status-bar">
            <span>{wordCount} words</span>
            <span>{content.length} characters</span>
            <span>{content.split('\n').length} lines</span>
            {!canEdit && <span className="readonly-badge">Read only</span>}
          </div>
        </main>
      </div>
    </div>
  );
}

// Outer wrapper provides the socket context
export default function Editor() {
  const token = localStorage.getItem('token');
  return (
    <SocketProvider token={token}>
      <EditorInner />
    </SocketProvider>
  );
}