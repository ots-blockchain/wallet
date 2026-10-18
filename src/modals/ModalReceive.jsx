import React, { useState } from 'react';
import { Modal, Title, Text, Button, Card } from '@telegram-apps/telegram-ui';
import { Copy, Check } from 'lucide-react';
import { useI18n } from '../i18n';
import QrCodeView from '../components/QrCodeView';
import { tmaService } from '../services/tmaService';

export default function ModalReceive({ open, onClose, address, onCopy }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    tmaService.haptic('light');
    tmaService.copyText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (onCopy) onCopy();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      header={<Modal.Header />}
    >
      <div style={{ padding: '8px 20px 32px', textAlign: 'center' }}>
        <Title level="2" weight="2" style={{ marginBottom: '6px' }}>
          {t('receiveTitle')}
        </Title>

        <Text
          style={{
            color: 'var(--tgui--hint_color, #707579)',
            marginBottom: '20px',
            display: 'block'
          }}
        >
          {t('receiveSubtitle')}
        </Text>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <QrCodeView value={address} size={180} />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <Card
            type="plain"
            style={{
              padding: '14px 16px',
              fontFamily: 'monospace',
              fontSize: '14px',
              letterSpacing: '0.8px',
              wordBreak: 'break-all',
              whiteSpace: 'pre-line',
              textAlign: 'center',
              backgroundColor: 'var(--tgui--secondary_bg_color, #141414)',
              borderRadius: '12px',
              color: 'var(--tgui--text_color, #ffffff)',
              lineHeight: '1.6'
            }}
          >
            {address ? (address.match(/.{1,13}/g)?.join('\n') || address) : ''}
          </Card>
        </div>

        <Button
          size="l"
          mode="filled"
          stretched
          before={copied ? <Check size={18} /> : <Copy size={18} />}
          onClick={handleCopy}
        >
          {copied ? t('copied') : t('copyAddress')}
        </Button>
      </div>
    </Modal>
  );
}
