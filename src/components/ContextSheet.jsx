import React from 'react';
import { Modal, List, Section, Cell, Button } from '@telegram-apps/telegram-ui';
import { ExternalLink, ArrowUpRight, Zap, Copy } from 'lucide-react';
import { useI18n } from '../i18n';
import { tmaService } from '../services/tmaService';
import { EXPLORER_URL } from '../services/blockchainService';
import { shortenAddress } from '../utils/format';

export default function ContextSheet({
  open,
  onClose,
  item,
  type = 'transfer', // 'transfer' | 'contract'
  onRepeatTransfer,
  onCallContract,
  onCopyHash
}) {
  const { t } = useI18n();

  if (!item) return null;

  const handleOpenExplorer = () => {
    tmaService.haptic('light');
    if (item.hash) {
      tmaService.openLink(`${EXPLORER_URL}/tx/${item.hash}`);
    } else if (item.address) {
      tmaService.openLink(`${EXPLORER_URL}/account/${item.address}`);
    }
    onClose();
  };

  const handleRepeat = () => {
    tmaService.haptic('medium');
    if (onRepeatTransfer) onRepeatTransfer(item);
    onClose();
  };

  const handleCall = () => {
    tmaService.haptic('medium');
    if (onCallContract) onCallContract(item);
    onClose();
  };

  const handleCopy = () => {
    tmaService.haptic('light');
    const target = item.hash || item.address || item.to;
    if (target) {
      tmaService.copyText(target);
      if (onCopyHash) onCopyHash(target);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      header={<Modal.Header />}
    >
      <div style={{ padding: '0 0 24px' }}>
        <List>
          <Section
            header={
              item.hash
                ? `Hash: ${shortenAddress(item.hash, 8, 8)}`
                : (item.address ? `Contract: ${shortenAddress(item.address, 8, 8)}` : t('options'))
            }
          >
            <Cell
              before={<ExternalLink size={20} />}
              onClick={handleOpenExplorer}
            >
              {t('openInExplorer')}
            </Cell>

            {type === 'transfer' && (
              <Cell
                before={<ArrowUpRight size={20} />}
                onClick={handleRepeat}
              >
                {t('repeatTransfer')}
              </Cell>
            )}

            {type === 'contract' && (
              <Cell
                before={<Zap size={20} />}
                onClick={handleCall}
              >
                {t('callContractAction')}
              </Cell>
            )}

            <Cell
              before={<Copy size={20} />}
              onClick={handleCopy}
            >
              {t('copy')} {item.hash ? 'Tx Hash' : 'Address'}
            </Cell>
          </Section>
        </List>

        <div style={{ padding: '8px 16px 0' }}>
          <Button size="l" mode="plain" stretched onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
