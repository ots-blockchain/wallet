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
  Accordion
} from '@telegram-apps/telegram-ui';
import { ArrowUpDown, ChevronDown, Check } from 'lucide-react';
import { useI18n } from '../i18n';
import { tmaService } from '../services/tmaService';
import { formatOtsAmount } from '../utils/format';
import TokenIcon from '../components/TokenIcon';

const TOKENS = [
  { value: 'OTS', label: 'OTS', name: 'Open Transaction System', baseRate: 1.0 },
  { value: 'GRAM', label: 'GRAM', name: 'Gram (prev. Toncoin)', baseRate: 0.42 }
];

export function getExchangeRate(fromTokenSymbol, toTokenSymbol) {
  const from = TOKENS.find((t) => t.value === fromTokenSymbol);
  const to = TOKENS.find((t) => t.value === toTokenSymbol);
  if (!from || !to || from.baseRate === 0) return 1;
  return to.baseRate / from.baseRate;
}

export default function ModalSwap({
  open,
  onClose,
  activeWallet,
  availableBalance,
  onConfirmSwap
}) {
  const { t } = useI18n();
  const [fromToken, setFromToken] = useState('OTS');
  const [toToken, setToToken] = useState('GRAM');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [amtError, setAmtError] = useState(false);
  const [step, setStep] = useState('input'); // 'input' | 'confirm'
  const [isSwapping, setIsSwapping] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // null | 'from' | 'to'

  const calculateOutput = (amount, from, to) => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return '';
    const rate = getExchangeRate(from, to);
    return (num * rate).toFixed(4);
  };

  // Recalculate output on input amount change
  const handleFromChange = (val) => {
    setFromAmount(val);
    setAmtError(false);
    setToAmount(calculateOutput(val, fromToken, toToken));
  };

  const handleSelectToken = (field, token) => {
    tmaService.haptic('selection');
    let nextFrom = fromToken;
    let nextTo = toToken;

    if (field === 'from') {
      if (token === fromToken) {
        setOpenDropdown(null);
        return;
      }
      nextFrom = token;
      // If user selected the same token currently in 'to', pick an alternative available token
      if (token === toToken) {
        nextTo = TOKENS.find((t) => t.value !== token)?.value || fromToken;
      }
    } else {
      if (token === toToken) {
        setOpenDropdown(null);
        return;
      }
      nextTo = token;
      // If user selected the same token currently in 'from', pick an alternative available token
      if (token === fromToken) {
        nextFrom = TOKENS.find((t) => t.value !== token)?.value || toToken;
      }
    }

    setFromToken(nextFrom);
    setToToken(nextTo);
    if (fromAmount) {
      setToAmount(calculateOutput(fromAmount, nextFrom, nextTo));
    }
    setOpenDropdown(null);
  };

  const handleSwapTokens = () => {
    tmaService.haptic('selection');
    const nextFrom = toToken;
    const nextTo = fromToken;
    setFromToken(nextFrom);
    setToToken(nextTo);

    const nextFromAmt = toAmount;
    setFromAmount(nextFromAmt);
    if (nextFromAmt) {
      setToAmount(calculateOutput(nextFromAmt, nextFrom, nextTo));
    }
  };

  const handleProceed = () => {
    setAmtError(false);
    const num = parseFloat(fromAmount);
    if (isNaN(num) || num <= 0) {
      setAmtError(true);
      tmaService.haptic('error');
      return;
    }

    if (fromToken === 'OTS') {
      const neededNano = BigInt(Math.round(num * 1e9));
      if (neededNano > availableBalance) {
        setAmtError(true);
        tmaService.haptic('error');
        return;
      }
    }

    tmaService.haptic('medium');
    setStep('confirm');
  };

  const handleExecute = async () => {
    setIsSwapping(true);
    try {
      if (onConfirmSwap) {
        await onConfirmSwap({
          fromToken,
          toToken,
          fromAmount,
          toAmount
        });
      }
      setStep('input');
      setFromAmount('');
      setToAmount('');
      setAmtError(false);
      onClose();
    } catch (err) {
      setAmtError(true);
      tmaService.haptic('error');
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setStep('input');
          setAmtError(false);
          setOpenDropdown(null);
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
                {t('swapTitle')}
              </Title>
              <Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>
                {t('mainBalance')}: {formatOtsAmount(availableBalance)} OTS
              </Text>
            </div>

            <List>
              {/* Single Section containing both You Pay and You Receive */}
              <Section>
                <div style={{ padding: '12px 16px 14px', position: 'relative' }}>
                  {/* You Pay Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px', marginBottom: '6px' }}>
                    <Text style={{ fontSize: '13px', color: 'var(--tgui--hint_color, #707579)' }}>
                      {t('youPay')}
                    </Text>
                    {fromToken === 'OTS' && (
                      <Text
                        style={{ fontSize: '12px', color: 'var(--tgui--link_color, #2481cc)', cursor: 'pointer', fontWeight: '500' }}
                        onClick={() => {
                          tmaService.haptic('light');
                          handleFromChange((Number(availableBalance) / 1e9).toString());
                        }}
                      >
                        MAX
                      </Text>
                    )}
                  </div>

                  {/* Input 1: You Pay */}
                  <div style={{ position: 'relative' }}>
                    <Input
                      status={amtError ? 'error' : undefined}
                      type="number"
                      step="any"
                      value={fromAmount}
                      onChange={(e) => handleFromChange(e.target.value)}
                      placeholder="0.0"
                      before={
                        <div style={{ display: 'flex', alignItems: 'center', marginRight: '6px' }}>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              tmaService.haptic('light');
                              setOpenDropdown(openDropdown === 'from' ? null : 'from');
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 4px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              userSelect: 'none'
                            }}
                          >
                            <TokenIcon token={fromToken} size={26} />
                            <ChevronDown size={14} style={{ color: 'var(--tgui--hint_color, #707579)' }} />
                          </div>
                          {/* Distinct vertical divider line */}
                          <div
                            style={{
                              width: '1px',
                              height: '24px',
                              backgroundColor: 'var(--tgui--secondary_fill, rgba(255, 255, 255, 0.14))',
                              margin: '0 4px 0 8px'
                            }}
                          />
                        </div>
                      }
                    />

                    {/* Multiselect styled Dropdown for 'from' */}
                    {openDropdown === 'from' && (
                      <>
                        <div
                          onClick={() => setOpenDropdown(null)}
                          style={{ position: 'fixed', inset: 0, zIndex: 100 }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            minWidth: '220px',
                            zIndex: 101,
                            backgroundColor: 'var(--tgui--section_bg_color, var(--tgui--bg_color, #141414))',
                            borderRadius: '12px',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.36), 0 0 2px 1px var(--tgui--secondary_fill, rgba(255, 255, 255, 0.08))',
                            overflow: 'hidden',
                            animation: 'fadeIn 0.15s ease'
                          }}
                        >
                          {TOKENS.map((tok) => {
                            const isSelected = fromToken === tok.value;
                            return (
                              <div
                                key={tok.value}
                                onClick={() => handleSelectToken('from', tok.value)}
                                style={{
                                  padding: '10px 14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  backgroundColor: isSelected ? 'var(--tgui--secondary_fill, rgba(255, 255, 255, 0.08))' : 'transparent',
                                  transition: 'background-color 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <TokenIcon token={tok.value} size={26} />
                                  <div>
                                    <Text weight="2" style={{ fontSize: '14px', display: 'block', lineHeight: 1.2 }}>
                                      {tok.label}
                                    </Text>
                                    <Text style={{ fontSize: '11px', color: 'var(--tgui--hint_color, #707579)' }}>
                                      {tok.name}
                                    </Text>
                                  </div>
                                </div>
                                {isSelected && <Check size={16} style={{ color: 'var(--tgui--link_color, #2481cc)' }} />}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Centered Flip Button: perfectly positioned midway between Input 1 and Input 2 */}
                  <div
                    style={{
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      zIndex: 10,
                      margin: '-4px 0'
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleSwapTokens}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--tgui--section_bg_color, var(--tgui--bg_color, #141414))',
                        color: 'var(--tgui--link_color, #2481cc)',
                        border: '3px solid var(--tgui--bg_color, #000000)',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0,
                        outline: 'none',
                        transition: 'transform 0.15s ease'
                      }}
                      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.9)')}
                      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      <ArrowUpDown size={15} />
                    </button>
                  </div>

                  {/* Input 2: You Receive */}
                  <div style={{ position: 'relative' }}>
                    <Input
                      type="number"
                      step="any"
                      value={toAmount}
                      readOnly
                      placeholder="0.0"
                      before={
                        <div style={{ display: 'flex', alignItems: 'center', marginRight: '6px' }}>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              tmaService.haptic('light');
                              setOpenDropdown(openDropdown === 'to' ? null : 'to');
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 4px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              userSelect: 'none'
                            }}
                          >
                            <TokenIcon token={toToken} size={26} />
                            <ChevronDown size={14} style={{ color: 'var(--tgui--hint_color, #707579)' }} />
                          </div>
                          {/* Distinct vertical divider line */}
                          <div
                            style={{
                              width: '1px',
                              height: '24px',
                              backgroundColor: 'var(--tgui--secondary_fill, rgba(255, 255, 255, 0.14))',
                              margin: '0 4px 0 8px'
                            }}
                          />
                        </div>
                      }
                    />

                    {/* Multiselect styled Dropdown for 'to' */}
                    {openDropdown === 'to' && (
                      <>
                        <div
                          onClick={() => setOpenDropdown(null)}
                          style={{ position: 'fixed', inset: 0, zIndex: 100 }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            minWidth: '220px',
                            zIndex: 101,
                            backgroundColor: 'var(--tgui--section_bg_color, var(--tgui--bg_color, #141414))',
                            borderRadius: '12px',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.36), 0 0 2px 1px var(--tgui--secondary_fill, rgba(255, 255, 255, 0.08))',
                            overflow: 'hidden',
                            animation: 'fadeIn 0.15s ease'
                          }}
                        >
                          {TOKENS.map((tok) => {
                            const isSelected = toToken === tok.value;
                            return (
                              <div
                                key={tok.value}
                                onClick={() => handleSelectToken('to', tok.value)}
                                style={{
                                  padding: '10px 14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  backgroundColor: isSelected ? 'var(--tgui--secondary_fill, rgba(255, 255, 255, 0.08))' : 'transparent',
                                  transition: 'background-color 0.15s ease'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <TokenIcon token={tok.value} size={26} />
                                  <div>
                                    <Text weight="2" style={{ fontSize: '14px', display: 'block', lineHeight: 1.2 }}>
                                      {tok.label}
                                    </Text>
                                    <Text style={{ fontSize: '11px', color: 'var(--tgui--hint_color, #707579)' }}>
                                      {tok.name}
                                    </Text>
                                  </div>
                                </div>
                                {isSelected && <Check size={16} style={{ color: 'var(--tgui--link_color, #2481cc)' }} />}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Section>

              {/* Expandable Accordion Menu with Swap Details */}
              <Section>
                <Accordion expanded={detailsExpanded} onChange={setDetailsExpanded}>
                  <Accordion.Summary>
                    {t('swapDetails')}
                  </Accordion.Summary>
                  <Accordion.Content>
                    <div style={{ padding: '8px 16px 12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>{t('rate')}:</Text>
                        <Text weight="2">1 {fromToken} ≈ {getExchangeRate(fromToken, toToken).toFixed(4)} {toToken}</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>{t('slippage')}:</Text>
                        <Text weight="2">0.5%</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>{t('minimumReceived')}:</Text>
                        <Text weight="2">{toAmount ? (parseFloat(toAmount) * 0.995).toFixed(4) : '0.0'} {toToken}</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>{t('route')}:</Text>
                        <Text weight="2">{fromToken} → OTS DEX → {toToken}</Text>
                      </div>
                    </div>
                  </Accordion.Content>
                </Accordion>
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
                {t('confirmation')}
              </Title>
              <div style={{ width: '48px' }} />
            </div>

            <List>
              <Section header={t('confirmation')}>
                <Cell subhead={t('youPay')} after={`${fromAmount} ${fromToken}`}>
                  {t('send')}
                </Cell>
                <Cell subhead={t('youReceive')} after={`${toAmount} ${toToken}`}>
                  {t('receive')}
                </Cell>
                <Cell subhead={t('slippage')} after="0.5%">
                  {t('slippage')}
                </Cell>
                <Cell subhead={t('networkFee')} after="0.0001 OTS">
                  {t('route')}
                </Cell>
              </Section>
            </List>

            <div style={{ padding: '24px 16px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Button
                size="l"
                mode="filled"
                stretched
                loading={isSwapping}
                onClick={handleExecute}
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
