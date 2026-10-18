import React, { useState } from 'react';
import {
  Modal,
  Title,
  Text,
  Button,
  Input,
  List,
  Section,
  Cell,
  SegmentedControl,
  Badge
} from '@telegram-apps/telegram-ui';
import { ShieldCheck, Clock } from 'lucide-react';
import { useI18n } from '../i18n';
import { tmaService } from '../services/tmaService';
import { formatOtsAmount, toNanoOts } from '../utils/format';

export default function ModalStake({
  open,
  onClose,
  activeWallet,
  availableBalance = 0n,
  stakedBalance = 0n,
  unbonding = [],
  currentBlockIndex = 0,
  onConfirmStake,
  onConfirmUnstake
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState('stake'); // 'stake' | 'unstake' | 'queue'
  const [amount, setAmount] = useState('');
  const [amtError, setAmtError] = useState(false);
  const [step, setStep] = useState('input'); // 'input' | 'confirm'
  const [isProcessing, setIsProcessing] = useState(false);

  const resetState = () => {
    setStep('input');
    setAmount('');
    setAmtError(false);
  };

  const handleMaxAmount = () => {
    tmaService.haptic('light');
    if (tab === 'stake') {
      const fee = 100000n; // 0.0001 OTS
      if (availableBalance > fee) {
        setAmount(formatOtsAmount(availableBalance - fee));
      }
    } else if (tab === 'unstake') {
      if (stakedBalance > 0n) {
        setAmount(formatOtsAmount(stakedBalance));
      }
    }
  };

  const handleValidateAndProceed = () => {
    setAmtError(false);

    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) {
      setAmtError(true);
      tmaService.haptic('error');
      return;
    }

    try {
      const amountNano = toNanoOts(amount);
      if (tab === 'stake') {
        if (availableBalance < amountNano) {
          setAmtError(true);
          tmaService.haptic('error');
          return;
        }
      } else if (tab === 'unstake') {
        if (stakedBalance < amountNano) {
          setAmtError(true);
          tmaService.haptic('error');
          return;
        }
      }
    } catch {
      setAmtError(true);
      tmaService.haptic('error');
      return;
    }

    tmaService.haptic('medium');
    setStep('confirm');
  };

  const handleFinalSubmit = async () => {
    setIsProcessing(true);
    try {
      if (tab === 'stake' && onConfirmStake) {
        await onConfirmStake({
          amountOts: amount
        });
      } else if (tab === 'unstake' && onConfirmUnstake) {
        await onConfirmUnstake({
          amountOts: amount
        });
      }
      resetState();
      onClose();
    } catch {
      setAmtError(true);
      tmaService.haptic('error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          resetState();
          onClose();
        }
      }}
      header={<Modal.Header />}
    >
      <div style={{ padding: '0 0 28px' }}>
        {/* Navigation Mode Tabs */}
        <div style={{ padding: '8px 16px 12px' }}>
          <SegmentedControl>
            <SegmentedControl.Item
              selected={tab === 'stake'}
              onClick={() => {
                tmaService.haptic('selection');
                setTab('stake');
                setStep('input');
                setAmtError(false);
              }}
            >
              {t('stakeTab')}
            </SegmentedControl.Item>
            <SegmentedControl.Item
              selected={tab === 'unstake'}
              onClick={() => {
                tmaService.haptic('selection');
                setTab('unstake');
                setStep('input');
                setAmtError(false);
              }}
            >
              {t('unstakeTab')}
            </SegmentedControl.Item>
            <SegmentedControl.Item
              selected={tab === 'queue'}
              onClick={() => {
                tmaService.haptic('selection');
                setTab('queue');
              }}
            >
              {t('unbondingQueueTab')} {unbonding.length > 0 ? `(${unbonding.length})` : ''}
            </SegmentedControl.Item>
          </SegmentedControl>
        </div>

        {tab === 'queue' ? (
          /* 3. Unbonding Queue Tab */
          <div>
            <div style={{ padding: '8px 20px 16px', textAlign: 'center' }}>
              <Title level="2" weight="2">
                {t('unbondingBalance')}
              </Title>
              <Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>
                {unbonding.length === 0
                  ? t('unbondingEmpty')
                  : t('maturedAutoCredit')}
              </Text>
            </div>

            <List>
              <Section header={t('unbondingQueueTab')}>
                {unbonding.length === 0 ? (
                  <Cell subtitle={t('unstakeNotice')}>
                    {t('unbondingEmpty')}
                  </Cell>
                ) : (
                  unbonding.map((entry, idx) => {
                    const remainingBlocks = Math.max(0, Number(entry.unlockBlock) - Number(currentBlockIndex));
                    const approxSeconds = remainingBlocks * 3;
                    const approxHours = (approxSeconds / 3600).toFixed(1);

                    return (
                      <Cell
                        key={idx}
                        before={<Clock size={20} style={{ color: 'var(--tgui--link_color, #2481cc)' }} />}
                        after={
                          <Badge mode={remainingBlocks === 0 ? 'filled' : 'bezeled'}>
                            {remainingBlocks === 0
                              ? 'Unlock Ready'
                              : `${remainingBlocks} blk (~${approxHours}h)`}
                          </Badge>
                        }
                        subhead={`${t('blocksRemaining')}: ${remainingBlocks}`}
                        subtitle={`Target Block: #${entry.unlockBlock}`}
                      >
                        <Text weight="2">+{formatOtsAmount(entry.amount)} OTS</Text>
                      </Cell>
                    );
                  })
                )}
              </Section>
            </List>
          </div>
        ) : step === 'input' ? (
          /* Input Form for Stake or Unstake */
          <div>
            <div style={{ padding: '8px 20px 16px', textAlign: 'center' }}>
              <Title level="2" weight="2">
                {tab === 'stake' ? t('stakeTitle') : t('actionUnstakeOts')}
              </Title>
              <Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>
                {tab === 'stake'
                  ? `${t('mainBalance')}: ${formatOtsAmount(availableBalance)} OTS`
                  : `${t('stakedBalance')}: ${formatOtsAmount(stakedBalance)} OTS`}
              </Text>
            </div>

            <List>
              <Section
                header={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span>{tab === 'stake' ? t('stakeAmount') : t('unstakeAmount')}</span>
                    <span
                      style={{
                        cursor: 'pointer',
                        color: 'var(--tgui--link_color, #2481cc)',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                      onClick={handleMaxAmount}
                    >
                      {t('maxAmount')}
                    </span>
                  </div>
                }
                footer={
                  <div style={{ padding: '6px 16px 0' }}>
                    <Text style={{ fontSize: '13px', color: 'var(--tgui--hint_color, #707579)', lineHeight: '1.4' }}>
                      {tab === 'stake' ? t('stakeDesc') : t('unstakeNotice')}
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
            </List>

            <div style={{ padding: '20px 16px 0' }}>
              <Button size="l" mode="filled" stretched onClick={handleValidateAndProceed}>
                {t('continue')}
              </Button>
            </div>
          </div>
        ) : (
          /* Step 2: Confirmation View */
          <div>
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
                <Cell subhead={t('amount')} after={`${amount} OTS`}>
                  {tab === 'stake' ? t('stake') : t('actionUnstakeOts')}
                </Cell>
                <Cell subhead={t('networkFee')} after="0.0001 OTS">
                  {t('otsNetwork')}
                </Cell>
                {tab === 'unstake' && (
                  <Cell subhead={t('unbondingBalance')} after="~24h (28 800 blk)">
                    {t('maturedAutoCredit')}
                  </Cell>
                )}
              </Section>
            </List>

            <div style={{ padding: '24px 16px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Button
                size="l"
                mode="filled"
                stretched
                loading={isProcessing}
                onClick={handleFinalSubmit}
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
