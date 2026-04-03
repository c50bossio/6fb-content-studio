import { useEffect, useState } from 'react';

interface UpdateInfo {
  version: string;
}

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready';

export default function UpdateBanner() {
  const [state, setState] = useState<UpdateState>('idle');
  const [version, setVersion] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onUpdateAvailable) return;

    const offAvailable = api.onUpdateAvailable((info: UpdateInfo) => {
      setVersion(info.version);
      setState('available');
    });

    const offDownloaded = api.onUpdateDownloaded((info: UpdateInfo) => {
      setVersion(info.version);
      setState('ready');
    });

    return () => {
      offAvailable?.();
      offDownloaded?.();
    };
  }, []);

  if (dismissed || state === 'idle') return null;

  const isReady = state === 'ready';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '14px',
        background: 'rgba(18, 18, 18, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(0, 200, 81, 0.3)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,200,81,0.1)',
        maxWidth: '320px',
        animation: 'slideUp 0.3s ease',
      }}
    >
      {/* Icon */}
      <div style={{
        width: '32px', height: '32px', borderRadius: '8px',
        background: 'rgba(0,200,81,0.12)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {isReady ? (
          <svg width="16" height="16" fill="none" stroke="#00c851" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        ) : (
          <svg width="16" height="16" fill="none" stroke="#00c851" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#ffffff', lineHeight: 1.3 }}>
          {isReady ? `v${version} ready to install` : `v${version} downloading…`}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#888888', lineHeight: 1.3 }}>
          {isReady ? 'Restart to get the latest features' : 'Installing in the background'}
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        {isReady && (
          <button
            onClick={() => window.electronAPI?.installUpdate?.()}
            style={{
              padding: '6px 12px', borderRadius: '8px', border: 'none',
              background: '#00c851', color: '#000', fontSize: '11px',
              fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Restart
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          style={{
            padding: '6px 8px', borderRadius: '8px', border: '1px solid #333',
            background: 'transparent', color: '#888', fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
