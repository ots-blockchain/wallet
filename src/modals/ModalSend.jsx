import React, { useState, useEffect } from 'react';
import {
  Modal,
  Title,
  Text,
  Button,
  IconButton,
  Input,
  Textarea,
  List,
  Section,
  Cell
} from '@telegram-apps/telegram-ui';
import { QrCode, Copy } from 'lucide-react';
import { useI18n } from '../i18n';
import { tmaService } from '../services/tmaService';
import { formatOtsAmount, toNanoOts, shortenAddress } from '../utils/format';

export default function ModalSend({
  open,
  onClose,
  activeWallet,
  availableBalance,
  onConfirmSend,
  prefill = null
}) {
  const { t } = useI18n();
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [addrError, setAddrError] = useState(false);
  const [amtError, setAmtError] = useState(false);
  const [step, setStep] = useState('input'); // 'input' | 'confirm'
  const [isSending, setIsSending] = useState(false);

  const networkFee = 100000n; // 0.0001 OTS
  const feeOts = formatOtsAmount(networkFee);

  useEffect(() => {
    if (prefill) {
      if (prefill.to) setToAddress(prefill.to);
      if (prefill.amount) setAmount(formatOtsAmount(prefill.amount));
    }
  }, [prefill]);

  const handleScanQr = async () => {
    tmaService.haptic('light');
    try {
      const scanned = await tmaService.showQrScanner('Scan OTS address');
      if (scanned) {
        setToAddress(scanned);
        setAddrError(false);
      }
    } catch { }
  };

  const handleMaxAmount = () => {
    tmaService.haptic('light');
    if (availableBalance > networkFee) {
      const maxNano = availableBalance - networkFee;
      setAmount(formatOtsAmount(maxNano));
      setAmtError(false);
    } else {
      setAmount('0');
    }
  };

  const handleValidateAndProceed = () => {
    setAddrError(false);
    setAmtError(false);

    const cleanAddr = toAddress.trim();
    if (!cleanAddr) {
      setAddrError(true);
      tmaService.haptic('error');
      return;
    }

    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) {
      setAmtError(true);
      tmaService.haptic('error');
      return;
    }

    try {
      const amountNano = toNanoOts(amount);
      const totalNano = amountNano + networkFee;
      if (availableBalance < totalNano) {
        setAmtError(true);
        tmaService.haptic('error');
        return;
      }
    } catch (e) {
      setAmtError(true);
      tmaService.haptic('error');
      return;
    }

    tmaService.haptic('medium');
    setStep('confirm');
  };

  const handleFinalSend = async () => {
    setIsSending(true);
    try {
      await onConfirmSend({
        toAddress: toAddress.trim(),
        amountOts: amount,
        comment: comment.trim()
      });
      setStep('input');
      setToAddress('');
      setAmount('');
      setComment('');
      setAddrError(false);
      setAmtError(false);
      onClose();
    } catch (err) {
      setAmtError(true);
      tmaService.haptic('error');
    } finally {
      setIsSending(false);
    }
  };

  const totalOts = amount ? (parseFloat(amount) + parseFloat(feeOts)).toFixed(6).replace(/0+$/, '').replace(/\.$/, '') : '0';

  return (
    <Modal
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setStep('input');
          setAddrError(false);
          setAmtError(false);
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
                {t('sendTitle')}
              </Title>
              <Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>
                {t('mainBalance')}: {formatOtsAmount(availableBalance)} OTS
              </Text>
            </div>

            <List>
              <Section header={t('recipientAddress')}>
                <div style={{ padding: '0 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <Input
                      status={addrError ? 'error' : undefined}
                      value={toAddress}
                      onChange={(e) => {
                        setToAddress(e.target.value);
                        setAddrError(false);
                      }}
                      placeholder={t('recipientPlaceholder')}
                    />
                  </div>
                  <IconButton size="m" mode="bezeled" onClick={handleScanQr}>
                    <QrCode size={20} />
                  </IconButton>
                </div>
              </Section>

              <Section
                header={
                  <Section.Header>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span>{t('amount')}</span>
                      <span
                        style={{
                          color: 'var(--tgui--link_color, #2481cc)',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                        onClick={handleMaxAmount}
                      >
                        MAX
                      </span>
                    </div>
                  </Section.Header>
                }
                footer={
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px 0' }}>
                    <Text style={{ fontSize: '13px', color: 'var(--tgui--hint_color, #707579)' }}>
                      {t('networkFee')}: ~{feeOts} OTS
                    </Text>
                  </div>
                }
              >
                <div style={{ padding: '0 16px' }}>
                  <Input
                    status={amtError ? 'error' : undefined}
                    type="number"
                    step="any"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setAmtError(false);
                    }}
                    placeholder="0.0"
                    after={<Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>OTS</Text>}
                  />
                </div>
              </Section>

              <Section header={`${t('comment')} (${t('optional')})`}>
                <div style={{ padding: '0 16px' }}>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t('commentPlaceholder')}
                    rows={2}
                    style={{ resize: 'none' }}
                  />
                </div>
              </Section>
            </List>

            <div style={{ padding: '20px 16px 0' }}>
              <Button size="l" mode="filled" stretched onClick={handleValidateAndProceed}>
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
                {t('confirmation')}
              </Title>
              <div style={{ width: '48px' }} />
            </div>

            <List>
              <Section header={t('confirmation')}>
                <Cell subhead={t('recipientAddress')} subtitle={toAddress}>
                  {shortenAddress(toAddress, 8, 8)}
                </Cell>
                <Cell subhead={t('amount')} after={`${amount} OTS`}>
                  {t('actionTransferOts')}
                </Cell>
                <Cell subhead={t('networkFee')} after={`${feeOts} OTS`}>
                  {t('otsNetwork')}
                </Cell>
                {comment && (
                  <Cell subhead={t('comment')} subtitle={comment}>
                    {t('comment')}
                  </Cell>
                )}
                <Cell subhead={t('total')} after={`${totalOts} OTS`}>
                  <Text weight="2">{t('total')}</Text>
                </Cell>
              </Section>
            </List>

            <div style={{ padding: '24px 16px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Button
                size="l"
                mode="filled"
                stretched
                loading={isSending}
                onClick={handleFinalSend}
              >
                {t('confirm')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
