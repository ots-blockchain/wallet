import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  List,
  Section,
  Cell,
  Switch,
  Title,
  Text,
  Button,
  Modal,
  Banner,
  PinInput
} from '@telegram-apps/telegram-ui';
import { Check, ChevronDown } from 'lucide-react';
import { useI18n } from '../i18n';
import { tmaService } from '../services/tmaService';

const LANG_OPTIONS = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' }
];

export default function ScreenSettings({
  activeWallet,
  onLockWallet,
  onVerifyPin,
  onChangePin
}) {
  const { lang, setLang, t } = useI18n();
  const [langModalOpen, setLangModalOpen] = useState(false);

  // Change PIN flow state
  const [changePinOpen, setChangePinOpen] = useState(false);
  const [pinStep, setPinStep] = useState('current'); // 'current' | 'new' | 'confirm'
  const [currentPin, setCurrentPin] = useState([]);
  const [newPin, setNewPin] = useState([]);
  const [confirmPin, setConfirmPin] = useState([]);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);

  const handleCurrentPinInput = async (digits) => {
    setCurrentPin(digits);
    setPinError('');

    if (digits && digits.length === 4) {
      const pinStr = digits.join('');
      tmaService.haptic('medium');

      try {
        await onVerifyPin(pinStr);
        setPinStep('new');
      } catch (err) {
        tmaService.haptic('error');
        setPinError(err.message || t('pinMismatch'));
        setCurrentPin([]);
      }
    }
  };

  const handleNewPinInput = (digits) => {
    setNewPin(digits);
    setPinError('');
    if (digits && digits.length === 4) {
      tmaService.haptic('medium');
      setTimeout(() => {
        setPinStep('confirm');
      }, 150);
    }
  };

  const handleConfirmPinInput = async (digits) => {
    setConfirmPin(digits);
    setPinError('');

    if (digits && digits.length === 4) {
      const newPinStr = newPin.join('');
      const confirmPinStr = digits.join('');

      if (newPinStr !== confirmPinStr) {
        tmaService.haptic('error');
        setPinError(t('pinMismatch'));
        setConfirmPin([]);
        return;
      }

      tmaService.haptic('success');
      try {
        const oldPinStr = currentPin.join('');
        await onChangePin(oldPinStr, newPinStr);
        setPinSuccess(true);
        setTimeout(() => {
          setChangePinOpen(false);
          setPinStep('current');
          setCurrentPin([]);
          setNewPin([]);
          setConfirmPin([]);
          setPinError('');
          setPinSuccess(false);
        }, 1200);
      } catch (err) {
        setPinError(err.message || t('error'));
      }
    }
  };

  const currentLangLabel = LANG_OPTIONS.find((o) => o.value === lang)?.label || 'Русский';

  return (
    <div className="tma-screen-content animate-fade-in" style={{ padding: '8px 0 24px' }}>
      {/* 1. Interface & Localization */}
      <List>
        <Section header={t('settingsTitle')}>
          {/* Language Selector Cell */}
          <Cell
            after={
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--tgui--hint_color, #707579)', fontSize: '14px' }}>
                  {currentLangLabel}
                </span>
                <span style={{ color: 'var(--tgui--hint_color, #707579)' }}>›</span>
              </div>
            }
            onClick={() => {
              tmaService.haptic('light');
              setLangModalOpen(true);
            }}
          >
            {t('language')}
          </Cell>
        </Section>

        {/* 2. Security Section */}
        <Section header={t('security')}>
          <Cell
            after={<span style={{ color: 'var(--tgui--hint_color, #707579)' }}>›</span>}
            onClick={() => {
              tmaService.haptic('light');
              setPinStep('current');
              setCurrentPin([]);
              setNewPin([]);
              setConfirmPin([]);
              setPinError('');
              setPinSuccess(false);
              setChangePinOpen(true);
            }}
          >
            {t('changePin')}
          </Cell>

          <Cell
            onClick={() => {
              tmaService.haptic('medium');
              onLockWallet();
            }}
          >
            <Text style={{ color: 'var(--tgui--destructive_text_color, #ef4444)' }}>
              {t('lockWalletNow')}
            </Text>
          </Cell>
        </Section>
      </List>

      {/* Change PIN Full-screen Flow */}
      {changePinOpen && (
        <>
          {createPortal(
            <div style={{ position: 'fixed', top: '12px', left: '16px', zIndex: 999999 }}>
              <Button
                size="s"
                mode="plain"
                onClick={() => {
                  tmaService.haptic('light');
                  setChangePinOpen(false);
                  setPinStep('current');
                  setCurrentPin([]);
                  setNewPin([]);
                  setConfirmPin([]);
                  setPinError('');
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

          {pinError &&
            createPortal(
              <div style={{ position: 'fixed', top: '56px', left: '16px', right: '16px', zIndex: 999999 }}>
                <Banner type="error" description={pinError} />
              </div>,
              document.body
            )}

          {pinSuccess &&
            createPortal(
              <div style={{ position: 'fixed', top: '56px', left: '16px', right: '16px', zIndex: 999999 }}>
                <Banner type="section" description={t('pinChangedSuccess')} />
              </div>,
              document.body
            )}

          {pinStep === 'current' && (
            <PinInput
              label={t('enterCurrentPin')}
              pinCount={4}
              value={currentPin}
              onChange={handleCurrentPinInput}
            />
          )}
          {pinStep === 'new' && (
            <PinInput
              label={t('enterNewPin')}
              pinCount={4}
              value={newPin}
              onChange={handleNewPinInput}
            />
          )}
          {pinStep === 'confirm' && (
            <PinInput
              label={t('confirmPinTitle')}
              pinCount={4}
              value={confirmPin}
              onChange={handleConfirmPinInput}
            />
          )}
        </>
      )}

      {/* Language Selection Modal Sheet */}
      <Modal
        open={langModalOpen}
        onOpenChange={(isOpen) => setLangModalOpen(isOpen)}
        header={<Modal.Header />}
      >
        <div style={{ padding: '0 0 24px' }}>
          <List>
            <Section header={t('language')}>
              {LANG_OPTIONS.map((item) => {
                const isSelected = lang === item.value;
                return (
                  <Cell
                    key={item.value}
                    after={isSelected && <Check size={18} style={{ color: 'var(--tgui--link_color, #2481cc)' }} />}
                    onClick={() => {
                      tmaService.haptic('selection');
                      setLang(item.value);
                      setLangModalOpen(false);
                    }}
                  >
                    <Text weight="2">{item.label}</Text>
                  </Cell>
                );
              })}
            </Section>
          </List>
        </div>
      </Modal>
    </div>
  );
}
