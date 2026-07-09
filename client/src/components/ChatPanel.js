import React, { useState, useEffect, useRef } from 'react';
import { API } from '../contexts/AuthContext';
import { useSocketContext } from '../contexts/SocketContext';

export default function ChatPanel({ docId, emit, user }) {
  const { socketRef, connected } = useSocketContext();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  // Load history from DB
  useEffect(() => {
    setLoading(true);
    API.get(`/documents/${docId}/chat`)
      .then(res => {
        const history = (res.data.messages || []).map((m, i) => ({
          id: m._id?.toString() || `h${i}`,
          userId: m.userId?.toString(),
          username: m.username,
          color: m.color,
          message: m.message,
          timestamp: m.timestamp
        }));
        setMessages(prev => {
          const merged = [...history];
          for (const m of prev) {
            if (!merged.some(x => x.id === m.id)) merged.push(m);
          }
          return merged;
        });
      })
      .catch(err => console.error('Chat history error:', err))
      .finally(() => setLoading(false));
  }, [docId]);

  // Listen for new messages using socketRef directly
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handler = (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, { ...msg }];
      });
    };

    socket.on('chat_message', handler);

    return () => {
      socket.off('chat_message', handler);
    };
  }, [connected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (socketRef.current) {
      socketRef.current.emit('chat_message', { documentId: docId, message: input.trim() });
    }
    setInput('');
  };

  const formatTime = (ts) => {
    try { return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {loading && <div className="panel-loading"><div className="spinner sm" /></div>}
        {!loading && messages.length === 0 && (
          <div className="chat-empty">
            <p>No messages yet.</p>
            <p className="hint">Start a conversation with your collaborators.</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.userId?.toString() === user._id?.toString();
          return (
            <div key={msg.id} className={`chat-msg ${isMe ? 'mine' : 'theirs'}`}>
              {!isMe && (
                <div className="chat-avatar" style={{ background: msg.color || '#6366f1' }} title={msg.username}>
                  {msg.username?.[0]?.toUpperCase()}
                </div>
              )}
              <div className="chat-bubble-wrapper">
                {!isMe && <div className="chat-sender">{msg.username}</div>}
                <div className="chat-bubble" style={isMe ? {} : { borderColor: (msg.color || '#6366f1') + '40' }}>
                  {msg.message}
                </div>
                <div className="chat-time">{formatTime(msg.timestamp)}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input-row" onSubmit={sendMessage}>
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder="Send a message…" maxLength={500} autoComplete="off" />
        <button type="submit" className="btn btn-primary btn-sm" disabled={!input.trim()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
}