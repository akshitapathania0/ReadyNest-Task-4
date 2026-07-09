import React, { useState } from 'react';

export default function ActiveUsers({ users }) {
  const [showAll, setShowAll] = useState(false);

  if (users.length === 0) return (
    <div className="active-users empty">
      <span className="solo-dot"/>
      <span className="solo-text">Only you</span>
    </div>
  );

  const visible = showAll ? users : users.slice(0, 4);

  return (
    <div className="active-users">
      <div className="user-avatars">
        {visible.map((u, i) => (
          <div
            key={u.socketId || u.userId}
            className="user-avatar-wrapper"
            style={{ zIndex: users.length - i }}
            title={u.username}
          >
            <div className="avatar sm live" style={{ background: u.color }}>
              {u.username[0].toUpperCase()}
            </div>
            <span className="live-indicator"/>
          </div>
        ))}
        {users.length > 4 && !showAll && (
          <button className="more-users-btn" onClick={() => setShowAll(true)}>
            +{users.length - 4}
          </button>
        )}
      </div>
      <span className="active-count">{users.length} active</span>
    </div>
  );
}
