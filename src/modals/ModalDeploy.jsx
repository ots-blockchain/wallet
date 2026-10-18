import React, { useState } from 'react';
import {
  Modal,
  Title,
  Text,
  Textarea,
  Button,
  List,
  Section,
  Cell,
  Banner,
  Spinner
} from '@telegram-apps/telegram-ui';
import { useI18n } from '../i18n';
import { tmaService } from '../services/tmaService';
import { blockchainService } from '../services/blockchainService';
import { shortenAddress, formatOtsAmount } from '../utils/format';

export default function ModalDeploy({
  open,
  onClose,
  activeWallet,
  availableBalance = 0n,
  currentNonce = 0,
  onConfirmDeploy
}) {
  const { t } = useI18n();
  const [step, setStep] = useState('input'); // 'input' | 'confirm'
  const [code, setCode] = useState('');
  const [compiledAst, setCompiledAst] = useState(null);
  const [deployStats, setDeployStats] = useState({ count: 0, codeAmount: 0n, totalCost: 0n });
  const [futureAddress, setFutureAddress] = useState('');
  const [error, setError] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);

  const handleCompileAndProceed = () => {
    setError('');
    const cleanCode = code.trim();
    if (!cleanCode) {
      setError('Please provide contract source code');
      return;
    }

    try {
      const ast = blockchainService.compileContract(cleanCode);
      const stats = blockchainService.calculateDeployCost(ast);
      const predictedAddr = blockchainService.predictContractAddress(
        activeWallet?.publicKey,
        currentNonce
      );

      if (availableBalance < stats.totalCost) {
        setError(`Insufficient funds for deploy (Need ${formatOtsAmount(stats.totalCost)} OTS)`);
        return;
      }

      setCompiledAst(ast);
      setDeployStats(stats);
      setFutureAddress(predictedAddr);
      tmaService.haptic('medium');
      setStep('confirm');
    } catch (err) {
      setError(err.message || 'Compilation error');
    }
  };

  const handleFinalDeploy = async () => {
    setIsDeploying(true);
    try {
      if (onConfirmDeploy) {
        await onConfirmDeploy({
          compiledAst,
          costOts: deployStats.codeAmount,
          futureAddress
        });
      }
      setStep('input');
      onClose();
    } catch (err) {
      setError(err.message || 'Deploy failed');
    } finally {
      setIsDeploying(false);
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
                {t('deployTitle')}
              </Title>
              <Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>
                {t('deployContractDesc')}
              </Text>
            </div>

            <List>
              <Section header={t('contractCodeLabel')}>
                <div style={{ padding: '0 16px' }}>
                  <Textarea
                    status={error ? 'error' : undefined}
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setError('');
                    }}
                    placeholder={t('contractCodePlaceholder')}
                    rows={8}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      resize: 'none'
                    }}
                  />
                </div>
              </Section>
            </List>

            <div style={{ padding: '20px 16px 0' }}>
              <Button size="l" mode="filled" stretched onClick={handleCompileAndProceed}>
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
                {t('deployConfirmation')}
              </Title>
              <div style={{ width: '48px' }} />
            </div>

            <div style={{ padding: '8px 20px 16px', textAlign: 'center' }}>
              <Title level="2" weight="2">
                {formatOtsAmount(deployStats.totalCost)} OTS
              </Title>
              <Text style={{ color: 'var(--tgui--hint_color, #707579)' }}>
                {t('deployConfirmation')}
              </Text>
            </div>

            {error && (
              <div style={{ padding: '0 16px 12px' }}>
                <Banner type="error" description={error} />
              </div>
            )}

            <List>
              <Section header={t('confirmation')}>
                <Cell subhead={t('futureAddress')} subtitle={futureAddress}>
                  {shortenAddress(futureAddress, 8, 8)}
                </Cell>
                <Cell subhead={t('opcodesCount')} after={`${deployStats.count}`}>
                  {t('opcodesCount')}
                </Cell>
                <Cell subhead={t('deployCost')} after={`${formatOtsAmount(deployStats.codeAmount)} OTS`}>
                  {t('bytecode')}
                </Cell>
                <Cell subhead={t('networkFee')} after="0.0001 OTS">
                  {t('baseFee')}
                </Cell>
                <Cell subhead={t('total')} after={`${formatOtsAmount(deployStats.totalCost)} OTS`}>
                  <Text weight="2">{t('total')}</Text>
                </Cell>
              </Section>
            </List>

            <div style={{ padding: '20px 16px 0' }}>
              <Button
                size="l"
                mode="filled"
                stretched
                disabled={isDeploying}
                onClick={handleFinalDeploy}
              >
                {isDeploying ? (
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
