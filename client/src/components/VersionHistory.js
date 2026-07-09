import React, { useState, useEffect, useCallback } from 'react';
import { API } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useSocketContext } from '../contexts/SocketContext';

export default function VersionHistory({ docId, onRestore }) {
  const { socketRef, connected } = useSocketContext();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);
  const { notify } = useNotification();

  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get(`/documents/${docId}/versions`);
      setVersions(res.data.versions || []);
    } catch (err) {
      console.error('Versions error:', err);
      notify.error('Failed to load versions');
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  // Listen for version/save events using socketRef directly
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handler = () => {
      setTimeout(fetchVersions, 1000);
    };

    socket.on('version_saved', handler);
    socket.on('auto_saved', handler);

    return () => {
      socket.off('version_saved', handler);
      socket.off('auto_saved', handler);
    };
  }, [connected]);

  const handleRestore = async (version) => {
    if (!window.confirm(`Restore to version from ${new Date(version.savedAt).toLocaleString()}?`)) return;
    setRestoring(version._id);
    try {
      const res = await API.post(`/documents/${docId}/versions/${version._id}/restore`);
      onRestore(res.data.document.content);
      await fetchVersions();
      notify.success('Version restored');
    } catch {
      notify.error('Failed to restore version');
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (d) => new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="version-list">
      <button className="btn btn-ghost btn-sm" onClick={fetchVersions}
        style={{ width: '100%', marginBottom: 12 }}>
        ↻ Refresh
      </button>

      {loading && <div className="panel-loading"><div className="spinner sm" /></div>}

      {!loading && versions.length === 0 && (
        <div className="panel-empty">
          <p>No versions yet.</p>
          <p className="hint">Click 💾 to save a version, or keep editing — auto-versions are created every 5 seconds.</p>
        </div>
      )}

      {!loading && versions.map((v, i) => (
        <div key={v._id} className="version-item">
          <div className="version-meta">
            <div className="version-avatar" style={{ background: v.savedBy?.color || '#6366f1' }}>
              {v.savedBy?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="version-info">
              <div className="version-user">{v.savedBy?.username || 'Unknown'}</div>
              <div className="version-time">{formatDate(v.savedAt)}</div>
            </div>
            {i === 0 && <span className="badge badge-current">Latest</span>}
          </div>
          <div className="version-message">{v.message || 'No note'}</div>
          {v.charCount > 0 && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{v.charCount} chars</div>}
          <div className="version-preview">
            {v.content?.slice(0, 100) || '(empty)'}{v.content?.length > 100 ? '…' : ''}
          </div>
          {i !== 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => handleRestore(v)}
              disabled={restoring === v._id}>
              {restoring === v._id ? 'Restoring…' : '⏪ Restore'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}