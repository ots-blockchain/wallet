import React, { useState, useEffect } from 'react';
import {
  Modal,
  Title,
  Text,
  Input,
  Textarea,
  Button,
  List,
  Section,
  Cell,
  Banner,
  Spinner
} from '@telegram-apps/telegram-ui';
import { QrCode, Copy } from 'lucide-react';
import { useI18n } from '../i18n';
import { tmaService } from '../services/tmaService';
import { shortenAddress } from '../utils/format';

export default function ModalCall({
  open,
  onClose,
  activeWallet,
  availableBalance = 0n,
  onConfirmCall,
  prefillAddress = ''
}) {
  const { t } = useI18n();
  const [step, setStep] = useState('input'); // 'input' | 'confirm'
  const [contractAddress, setContractAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [gasLimit, setGasLimit] = useState('1'); // Default 1 OTS gas limit
  const [callData, setCallData] = useState('');
  const [error, setError] = useState('');
  const [isCalling, setIsCalling] = useState(false);

  useEffect(() => {
    if (prefillAddress) {
      setContractAddress(prefillAddress);
    }
  }, [prefillAddress]);

  const handleScanQr = async () => {
    tmaService.haptic('light');
    const scanned = await tmaService.scanQr(t('contractAddress'));
    if (scanned) setContractAddress(scanned);
  };

  const handlePaste = async () => {
    tmaService.haptic('light');
    try {
      const text = await navigator.clipboard.readText();
      if (text) setContractAddress(text.trim());
    } catch {}
  };

  const handleProceed = () => {
    setError('');
    const cleanAddr = contractAddress.trim();
    if (!cleanAddr) {
      setError(t('contractAddressPlaceholder'));
      return;
    }

    const gasNum = parseFloat(gasLimit || '1');
    if (isNaN(gasNum) || gasNum <= 0) {
      setError('Gas limit must be greater than 0');
      return;
    }

    tmaService.haptic('medium');
    setStep('confirm');
  };

  const handleFinalCall = async () => {
    setIsCalling(true);
    try {
      if (onConfirmCall) {
        await onConfirmCall({
          contractAddress: contractAddress.trim(),
          amountOts: amount || '0',
          gasLimitOts: gasLimit || '1',
          callData: callData.trim()
        });
      }
      setStep('input');
      onClose();
    } catch (err) {
      setError(err.message || 'Contract call failed');
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setStep('input');
          setError('');
          onClose();
        }
      }}
      header={<Modal.Header />}
    >
      <div style={{ padding: '0 0 28px' }}>
        {step === 'input' ? (
          <div>
            <div style={{ padding: '8px 20px 16px', textAlign: 'center' }}>
              <Title level="2" weight="2">
                {t('callTitle')}
              </Title>
              <Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>
                {t('callContractDesc')}
              </Text>
            </div>

            <List>
              <Section header={t('contractAddress')}>
                <div style={{ padding: '0 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <Input
                      status={error ? 'error' : undefined}
                      value={contractAddress}
                      onChange={(e) => {
                        setContractAddress(e.target.value);
                        setError('');
                      }}
                      placeholder={t('contractAddressPlaceholder')}
                    />
                  </div>
                  <Button size="s" mode="bezeled" onClick={handleScanQr}>
                    <QrCode size={18} />
                  </Button>
                  <Button size="s" mode="bezeled" onClick={handlePaste}>
                    <Copy size={18} />
                  </Button>
                </div>
              </Section>

              <Section header={`${t('amount')} (${t('optional')})`}>
                <div style={{ padding: '0 16px' }}>
                  <Input
                    type="number"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    after={<Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>OTS</Text>}
                  />
                </div>
              </Section>

              <Section header={t('gasLimit')}>
                <div style={{ padding: '0 16px' }}>
                  <Input
                    type="number"
                    step="any"
                    value={gasLimit}
                    onChange={(e) => setGasLimit(e.target.value)}
                    placeholder="1.0"
                    after={<Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>OTS</Text>}
                  />
                </div>
              </Section>

              <Section header={`${t('callData')} (${t('optional')})`}>
                <div style={{ padding: '0 16px' }}>
                  <Textarea
                    value={callData}
                    onChange={(e) => setCallData(e.target.value)}
                    placeholder={t('callDataPlaceholder')}
                    rows={3}
                    style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }}
                  />
                </div>
              </Section>
            </List>

            <div style={{ padding: '20px 16px 0' }}>
              <Button size="l" mode="filled" stretched onClick={handleProceed}>
                {t('continue')}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {/* Step 2: Confirmation View */}
            <div style={{ padding: '8px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Button size="s" mode="plain" onClick={() => setStep('input')}>
                ← {t('back')}
              </Button>
              <Title level="3" weight="2">
                {t('callConfirmation')}
              </Title>
              <div style={{ width: '48px' }} />
            </div>

            <div style={{ padding: '8px 20px 16px', textAlign: 'center' }}>
              <Title level="2" weight="2">
                {t('callContractAction')}
              </Title>
              <Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>
                {shortenAddress(contractAddress, 8, 8)}
              </Text>
            </div>

            {error && (
              <div style={{ padding: '0 16px 12px' }}>
                <Banner type="error" description={error} />
              </div>
            )}

            <List>
              <Section header={t('confirmation')}>
                <Cell subhead={t('contractAddress')} subtitle={contractAddress}>
                  {shortenAddress(contractAddress, 8, 8)}
                </Cell>
                {amount && parseFloat(amount) > 0 && (
                  <Cell subhead={t('amount')} after={`${amount} OTS`}>
                    Msg Value
                  </Cell>
                )}
                <Cell subhead={t('gasLimit')} after={`${gasLimit} OTS`}>
                  Max Gas
                </Cell>
                {callData && (
                  <Cell subhead={t('callData')} subtitle={callData}>
                    Arguments
                  </Cell>
                )}
                <Cell subhead={t('networkFee')} after="0.0001 OTS">
                  Base Fee
                </Cell>
              </Section>
            </List>

            <div style={{ padding: '20px 16px 0' }}>
              <Button
                size="l"
                mode="filled"
                stretched
                disabled={isCalling}
                onClick={handleFinalCall}
              >
                {isCalling ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Spinner size="s" /> {t('loading')}
                  </div>
                ) : (
                  t('confirm')
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
