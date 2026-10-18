import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { PinInput, Banner, Button } from '@telegram-apps/telegram-ui';
import { useI18n } from '../i18n';
import { tmaService } from '../services/tmaService';

export default function PinModal({ open, onClose, onVerify, onSuccess, title = null }) {
  const { t } = useI18n();
  const [pin, setPin] = useState([]);
  const [error, setError] = useState('');

  if (!open) return null;

  const handlePinChange = async (digits) => {
    setPin(digits);
    setError('');

    if (digits && digits.length === 4) {
      const pinStr = digits.join('');
      tmaService.haptic('medium');

      try {
        await onVerify(pinStr);
        await onSuccess(pinStr);
        tmaService.haptic('success');
        setPin([]);
        onClose();
      } catch (err) {
        tmaService.haptic('error');
        setError(err.message || t('error'));
        setPin([]);
      }
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'var(--tgui--bg_color, #000000)' }}>
      {/* Top Action Bar */}
      {createPortal(
        <div style={{ position: 'fixed', top: '12px', left: '16px', zIndex: 999999 }}>
          <Button
            size="s"
            mode="plain"
            onClick={() => {
              setPin([]);
              setError('');
              onClose();
            }}
            style={{
              color: 'var(--tgui--link_color, #2481cc)',
              fontSize: '15px',
              fontWeight: '500',
              padding: '4px 8px'
            }}
          >
            {t('cancel')}
          </Button>
        </div>,
        document.body
      )}

      {error &&
        createPortal(
          <div style={{ position: 'fixed', top: '56px', left: '16px', right: '16px', zIndex: 999999 }}>
            <Banner
              type="error"
              description={error}
            />
          </div>,
          document.body
        )}

      <PinInput
        label={title || t('enterPinToUnlock')}
        pinCount={4}
        value={pin}
        onChange={handlePinChange}
      />
    </div>
  );
}
