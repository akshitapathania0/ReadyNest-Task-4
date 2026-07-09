import React, { useState, useEffect, useCallback } from 'react';
import { API } from '../contexts/AuthContext';
import { useSocketContext } from '../contexts/SocketContext';

const ICONS = { created:'✨', joined:'👋', edited:'✏️', renamed:'📝', saved_version:'📌', restored_version:'⏪', added_collaborator:'➕', changed_role:'🔄', default:'•' };
const COLORS = { created:'#10b981', joined:'#6366f1', edited:'#f59e0b', renamed:'#3b82f6', saved_version:'#8b5cf6', restored_version:'#ef4444', added_collaborator:'#10b981', changed_role:'#f59e0b' };

export default function ActivityLog({ docId }) {
  const { socketRef, connected } = useSocketContext();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await API.get(`/documents/${docId}/activity`);
      setActivities(res.data.activities || []);
    } catch (err) {
      console.error('Activity error:', err);
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handler = () => setTimeout(fetchActivities, 1000);
    socket.on('auto_saved', handler);
    socket.on('version_saved', handler);
    socket.on('notification', handler);
    return () => {
      socket.off('auto_saved', handler);
      socket.off('version_saved', handler);
      socket.off('notification', handler);
    };
  }, [connected]);

  const formatDate = (d) => {
    const date = new Date(d), now = new Date(), diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
    return date.toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  };

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={fetchActivities} style={{ width:'100%', marginBottom:12 }}>
        ↻ Refresh
      </button>
      {loading && <div className="panel-loading"><div className="spinner sm" /></div>}
      {!loading && activities.length === 0 && <div className="panel-empty"><p>No activity yet.</p></div>}
      {!loading && (
        <div className="activity-list">
          {activities.map((a, i) => (
            <div key={i} className="activity-item">
              <div className="activity-icon" style={{ color: COLORS[a.action] || 'var(--text3)' }}>
                {ICONS[a.action] || ICONS.default}
              </div>
              <div className="activity-body">
                <div className="activity-detail">
                  <span className="activity-user" style={{ color: COLORS[a.action] || 'var(--accent)' }}>{a.username}</span>{' '}
                  <span>{a.detail}</span>
                </div>
                <div className="activity-time">{formatDate(a.timestamp)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}