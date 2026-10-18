import React, { useEffect } from 'react';
import { FixedLayout, Text } from '@telegram-apps/telegram-ui';

export default function TopNotification({ message, onClose, duration = 2500 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <FixedLayout
      vertical="top"
      style={{
        zIndex: 9999,
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}
    >
      <div
        onClick={onClose}
        style={{
          pointerEvents: 'auto',
          backgroundColor: 'var(--tgui--secondary_fill, rgba(23, 33, 43, 0.95))',
          color: 'var(--tgui--text_color, #ffffff)',
          border: '1px solid var(--tgui--secondary_fill, rgba(255, 255, 255, 0.15))',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '16px',
          padding: '10px 18px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '500',
          animation: 'topNotifyIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          cursor: 'pointer'
        }}
      >
        <Text weight="2" style={{ fontSize: '14px' }}>
          {message}
        </Text>
      </div>
    </FixedLayout>
  );
}
