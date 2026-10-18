import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  PinInput,
  Banner
} from '@telegram-apps/telegram-ui';
import { useI18n } from '../i18n';
import { tmaService } from '../services/tmaService';

export default function ScreenLock({ onUnlocked, onVerifyPin }) {
  const { t } = useI18n();
  const [pin, setPin] = useState([]);
  const [error, setError] = useState('');
  const [lockoutSecs, setLockoutSecs] = useState(0);

  useEffect(() => {
    if (lockoutSecs <= 0) return;
    const interval = setInterval(() => {
      setLockoutSecs((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSecs]);

  const handlePinChange = (digits) => {
    setPin(digits);
    setError('');

    if (digits && digits.length === 4) {
      const pinStr = digits.join('');
      tmaService.haptic('medium');

      setTimeout(async () => {
        try {
          await onVerifyPin(pinStr);
          tmaService.haptic('success');
          await onUnlocked(pinStr);
        } catch (err) {
          tmaService.haptic('error');
          setError(err.message || 'Incorrect PIN');
          setPin([]);
          if (err.status === 429) {
            const retryMatch = err.message.match(/(\d+)s/);
            setLockoutSecs(Number(retryMatch?.[1] || 30));
          }
        }
      }, 0);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {/* Alerts */}
      {lockoutSecs > 0 ? (
        createPortal(
          <div style={{ position: 'fixed', top: '56px', left: '16px', right: '16px', zIndex: 999999 }}>
            <Banner
              type="error"
              header={t('pinLocked')}
              description={t('tooManyAttempts', lockoutSecs)}
            />
          </div>,
          document.body
        )
      ) : (
        error &&
        createPortal(
          <div style={{ position: 'fixed', top: '56px', left: '16px', right: '16px', zIndex: 999999 }}>
            <Banner type="error" description={error} />
          </div>,
          document.body
        )
      )}

      <PinInput
        label={t('enterPinToUnlock')}
        pinCount={4}
        value={pin}
        onChange={handlePinChange}
      />
    </div>
  );
}
