import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Title,
  Text,
  Button,
  Input,
  Textarea,
  Banner,
  Card,
  PinInput,
  Modal
} from '@telegram-apps/telegram-ui';
import { Copy, Check } from 'lucide-react';
import { useI18n } from '../i18n';
import CryptoUtils from '@otsblockchain/lib/crypto';
import WalletWrapper from '@otsblockchain/lib/wallet';
import { tmaService } from '../services/tmaService';

export default function ScreenWelcome({ onCompleted, onWalletAdded, onCancel }) {
  const { t } = useI18n();
  const isAddingWallet = typeof onWalletAdded === 'function';
  // flow: 'start' | 'create_mnemonic' | 'name_wallet' | 'import' | 'set_pin' | 'confirm_pin'
  const [flow, setFlow] = useState('start');
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  const [walletName, setWalletName] = useState('');
  const [importInput, setImportInput] = useState('');
  const [tempWallet, setTempWallet] = useState(null);
  const [firstPin, setFirstPin] = useState([]);
  const [confirmPin, setConfirmPin] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleStartCreate = () => {
    tmaService.haptic('medium');
    setError('');
    try {
      const mnemonic = CryptoUtils.generateMnemonic();
      const wallet = WalletWrapper.fromMnemonic('Main Wallet', mnemonic);
      setGeneratedMnemonic(mnemonic);
      setWalletName('');
      setTempWallet(wallet);
      setFlow('create_mnemonic');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStartImport = () => {
    tmaService.haptic('light');
    setError('');
    setImportInput('');
    setWalletName('');
    setFlow('import');
  };

  const handleConfirmMnemonicSaved = () => {
    tmaService.haptic('medium');
    setFlow('name_wallet');
  };

  const handleConfirmWalletName = async () => {
    tmaService.haptic('medium');
    const finalName = walletName.trim() || t('walletNamePlaceholder') || 'Main Wallet';
    if (tempWallet) {
      tempWallet.name = finalName;
    }

    if (isAddingWallet) {
      setIsLoading(true);
      try {
        await onWalletAdded(tempWallet);
      } catch (err) {
        tmaService.haptic('error');
        setError(err.message || t('error'));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setFlow('set_pin');
  };

  const handleProcessImport = () => {
    setError('');
    const raw = importInput.trim();
    if (!raw) {
      setError(t('importPlaceholder'));
      return;
    }

    try {
      let wallet;
      const words = raw.split(/\s+/);
      if (words.length === 12 || words.length === 24) {
        wallet = WalletWrapper.fromMnemonic('Imported Wallet', raw);
      } else if (raw.length === 64) {
        wallet = new WalletWrapper('Imported Wallet', '', raw);
      } else {
        throw new Error(t('invalidMnemonic'));
      }

      setTempWallet(wallet);
      setWalletName('Imported Wallet');
      tmaService.haptic('success');
      setFlow('name_wallet');
    } catch (err) {
      tmaService.haptic('error');
      setError(err.message || t('invalidMnemonic'));
    }
  };

  const handleFirstPinChange = (digits) => {
    setFirstPin(digits);
    setError('');
    if (digits && digits.length === 4) {
      tmaService.haptic('medium');
      setTimeout(() => {
        setFlow('confirm_pin');
      }, 150);
    }
  };

  const handleConfirmPinChange = async (digits) => {
    setConfirmPin(digits);
    setError('');

    if (digits && digits.length === 4) {
      const pinStr1 = firstPin.join('');
      const pinStr2 = digits.join('');

      if (pinStr1 !== pinStr2) {
        tmaService.haptic('error');
        setError(t('pinMismatch'));
        setConfirmPin([]);
        return;
      }

      setIsLoading(true);
      tmaService.haptic('success');

      try {
        if (tempWallet) {
          tempWallet.name = walletName.trim() || tempWallet.name || 'Main Wallet';
        }
        await onCompleted(tempWallet, pinStr2);
      } catch (err) {
        setError(err.message || 'Failed to save wallet');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const isAddWalletChoice = isAddingWallet && flow === 'start';

  return (
    <div
      className={isAddWalletChoice ? undefined : 'tma-app-container'}
      style={isAddWalletChoice ? undefined : { padding: '24px 16px', overflowY: 'auto' }}
    >
      {/* 1. Start View */}
      {flow === 'start' && !isAddingWallet && (
        <div style={{ textAlign: 'center', marginTop: 'auto', marginBottom: 'auto', paddingBottom: '32px' }}>
          <Title level="1" weight="2" style={{ fontSize: '32px', marginBottom: '8px' }}>
            {t('welcomeTitle')}
          </Title>

          <Text style={{ color: 'var(--tgui--hint_color, #707579)', marginBottom: '40px', display: 'block', maxWidth: '320px', margin: '0 auto 40px' }}>
            {t('welcomeSubtitle')}
          </Text>

          {error && (
            <div style={{ marginBottom: '16px' }}>
              <Banner type="error" description={error} />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '320px', margin: '0 auto' }}>
            <Button
              size="l"
              mode="filled"
              stretched
              onClick={handleStartCreate}
            >
              {t('createNewWallet')}
            </Button>

            <Button
              size="l"
              mode="bezeled"
              stretched
              onClick={handleStartImport}
            >
              {t('importExistingWallet')}
            </Button>

            {isAddingWallet && (
              <Button size="m" mode="plain" stretched onClick={onCancel}>
                {t('cancel')}
              </Button>
            )}
          </div>
        </div>
      )}

      {flow === 'start' && isAddingWallet && (
        <Modal
          open
          onOpenChange={(isOpen) => !isOpen && onCancel()}
          header={<Modal.Header />}
        >
          <div style={{ padding: '8px 20px 28px', textAlign: 'center' }}>
            <Title level="2" weight="2" style={{ marginBottom: '8px' }}>
              {t('addWalletTitle')}
            </Title>
            <Text style={{ color: 'var(--tgui--hint_color, #707579)', display: 'block', lineHeight: '1.4', marginBottom: '24px' }}>
              {t('addWalletDesc')}
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Button size="l" mode="filled" stretched onClick={handleStartCreate}>
                {t('createNewWallet')}
              </Button>
              <Button size="l" mode="bezeled" stretched onClick={handleStartImport}>
                {t('importExistingWallet')}
              </Button>
              <Button size="m" mode="plain" stretched onClick={onCancel}>
                {t('cancel')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 2. Create: Show Mnemonic Phrase */}
      {flow === 'create_mnemonic' && (
        <div style={{ maxWidth: '400px', margin: 'auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <Title level="2" weight="2" style={{ marginBottom: '8px' }}>
              {t('secretPhraseTitle')}
            </Title>
            <Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>
              {t('secretPhraseDesc')}
            </Text>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              marginBottom: '16px'
            }}
          >
            {generatedMnemonic.split(' ').map((word, i) => (
              <Card
                key={i}
                type="plain"
                style={{
                  padding: '10px 6px',
                  textAlign: 'center',
                  fontSize: '13px',
                  backgroundColor: 'var(--tgui--secondary_bg_color, #141414)',
                  borderRadius: '10px'
                }}
              >
                <span style={{ color: 'var(--tgui--hint_color, #707579)', marginRight: '4px', fontSize: '11px' }}>
                  {i + 1}.
                </span>
                <span style={{ fontWeight: '500' }}>{word}</span>
              </Card>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            <Button
              size="m"
              mode="bezeled"
              stretched
              before={copied ? <Check size={16} /> : <Copy size={16} />}
              onClick={() => {
                tmaService.copyText(generatedMnemonic);
                tmaService.haptic('light');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? t('copied') : t('copy')}
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Button size="l" mode="filled" stretched onClick={handleConfirmMnemonicSaved}>
              {t('iSavedPhrase')}
            </Button>
            <Button size="m" mode="plain" stretched onClick={() => setFlow('start')}>
              {t('back')}
            </Button>
          </div>
        </div>
      )}

      {/* 3. Name Wallet Step */}
      {flow === 'name_wallet' && (
        <div style={{ maxWidth: '400px', margin: 'auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <Title level="2" weight="2" style={{ marginBottom: '8px' }}>
              {t('walletNameTitle')}
            </Title>
            <Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>
              {t('walletNameDesc')}
            </Text>
          </div>

          {error && (
            <div style={{ marginBottom: '16px' }}>
              <Banner type="error" description={error} />
            </div>
          )}

          <div style={{ marginBottom: '24px' }}>
            <Input
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              placeholder={t('walletNamePlaceholder')}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Button size="l" mode="filled" stretched onClick={handleConfirmWalletName} loading={isLoading}>
              {t('continue')}
            </Button>
            <Button
              size="m"
              mode="plain"
              stretched
              onClick={() => setFlow(generatedMnemonic ? 'create_mnemonic' : 'import')}
            >
              {t('back')}
            </Button>
          </div>
        </div>
      )}

      {/* 4. Import Wallet */}
      {flow === 'import' && (
        <div style={{ maxWidth: '400px', margin: 'auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <Title level="2" weight="2" style={{ marginBottom: '8px' }}>
              {t('importTitle')}
            </Title>
            <Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>
              {t('importPlaceholder')}
            </Text>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <Textarea
              status={error ? 'error' : undefined}
              value={importInput}
              onChange={(e) => {
                setImportInput(e.target.value);
                setError('');
              }}
              placeholder={t('importPlaceholder')}
              rows={4}
              style={{ fontFamily: 'monospace', fontSize: '13px', resize: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Button size="l" mode="filled" stretched onClick={handleProcessImport}>
              {t('importButton')}
            </Button>
            <Button size="m" mode="plain" stretched onClick={() => setFlow('start')}>
              {t('back')}
            </Button>
          </div>
        </div>
      )}

      {/* 5. Set 4-digit PIN Code */}
      {flow === 'set_pin' && (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {createPortal(
            <div style={{ position: 'fixed', top: '12px', left: '16px', zIndex: 999999 }}>
              <Button
                size="s"
                mode="plain"
                onClick={() => {
                  setFirstPin([]);
                  setConfirmPin([]);
                  setError('');
                  setFlow('name_wallet');
                }}
                style={{
                  color: 'var(--tgui--link_color, #2481cc)',
                  fontSize: '15px',
                  fontWeight: '500',
                  padding: '4px 8px'
                }}
              >
                {t('back')}
              </Button>
            </div>,
            document.body
          )}

          <PinInput
            label={t('setPinTitle')}
            pinCount={4}
            value={firstPin}
            onChange={handleFirstPinChange}
          />
        </div>
      )}

      {/* 6. Confirm 4-digit PIN Code */}
      {flow === 'confirm_pin' && (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {createPortal(
            <div style={{ position: 'fixed', top: '12px', left: '16px', zIndex: 999999 }}>
              <Button
                size="s"
                mode="plain"
                onClick={() => {
                  setFirstPin([]);
                  setConfirmPin([]);
                  setError('');
                  setFlow('set_pin');
                }}
                style={{
                  color: 'var(--tgui--link_color, #2481cc)',
                  fontSize: '15px',
                  fontWeight: '500',
                  padding: '4px 8px'
                }}
              >
                {t('back')}
              </Button>
            </div>,
            document.body
          )}

          {error &&
            createPortal(
              <div style={{ position: 'fixed', top: '56px', left: '16px', right: '16px', zIndex: 999999 }}>
                <Banner type="error" description={error} />
              </div>,
              document.body
            )}

          <PinInput
            label={t('confirmPinTitle')}
            pinCount={4}
            value={confirmPin}
            onChange={handleConfirmPinChange}
          />
        </div>
      )}
    </div>
  );
}
