import React, { useState, useEffect } from 'react';
import { Modal, Title, Text, Button, CircularProgress } from '@telegram-apps/telegram-ui';
import { useI18n } from '../i18n';

export default function ModalConfirm({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  isDestructive = false,
  countdownSeconds = 0
}) {
  const { t } = useI18n();
  const [progress, setProgress] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(countdownSeconds);

  useEffect(() => {
    if (!open || !countdownSeconds) {
      setProgress(100);
      setSecondsRemaining(0);
      return;
    }

    setProgress(0);
    setSecondsRemaining(countdownSeconds);

    const startTime = Date.now();
    const totalMs = countdownSeconds * 1000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / totalMs) * 100);
      const remaining = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));

      setProgress(pct);
      setSecondsRemaining(remaining);

      if (elapsed >= totalMs) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [open, countdownSeconds]);

  if (!open) return null;

  const isLocked = secondsRemaining > 0;

  return (
    <Modal
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      header={<Modal.Header />}
    >
      <div style={{ padding: '8px 20px 28px', textAlign: 'center' }}>
        <Title level="2" weight="2" style={{ marginBottom: '8px' }}>
          {title || t('confirmation')}
        </Title>

        {description && (
          <Text
            style={{
              color: 'var(--tgui--hint_color, #707579)',
              marginBottom: '24px',
              display: 'block',
              lineHeight: '1.4'
            }}
          >
            {description}
          </Text>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Button
            size="l"
            mode="filled"
            stretched
            disabled={isLocked}
            style={isDestructive ? {
              backgroundColor: 'var(--tgui--destructive_text_color, #ef4444)',
              color: 'var(--tgui--button_text_color, #ffffff)'
            } : undefined}
            before={
              isLocked ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: '6px' }}>
                  <CircularProgress size="small" progress={progress} />
                </div>
              ) : null
            }
            onClick={() => {
              if (isLocked) return;
              onConfirm();
              onClose();
            }}
          >
            {confirmText || t('confirm')}
          </Button>

          <Button
            size="l"
            mode="plain"
            stretched
            onClick={onClose}
          >
            {cancelText || t('cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
