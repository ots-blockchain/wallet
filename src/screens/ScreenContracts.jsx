import React, { useState } from 'react';
import {
  List,
  Section,
  Cell,
  Text,
  SegmentedControl,
  Badge
} from '@telegram-apps/telegram-ui';
import { Rocket, Zap } from 'lucide-react';
import { useI18n } from '../i18n';
import { tmaService } from '../services/tmaService';
import { shortenAddress, formatTimestamp } from '../utils/format';

export default function ScreenContracts({
  history,
  onOpenDeploy,
  onOpenCall,
  onSelectContractItem
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState('all'); // 'all' | 'deploy' | 'call'

  // Filter contract transactions
  const contractHistory = history.filter(
    (tx) => tx.type === 'deploy' || tx.type === 'call'
  );

  const filteredList = contractHistory.filter((tx) => {
    if (filter === 'deploy') return tx.type === 'deploy';
    if (filter === 'call') return tx.type === 'call';
    return true;
  });

  return (
    <div className="tma-screen-content animate-fade-in" style={{ padding: '12px 0 24px' }}>
      {/* 1. Header Actions: Deploy & Call Cells */}
      <List>
        <Section header={t('contractsTitle')}>
          <Cell
            before={<Rocket size={24} />}
            after={<span style={{ color: 'var(--tgui--hint_color, #707579)' }}>›</span>}
            subtitle={t('deployContractDesc')}
            onClick={() => {
              tmaService.haptic('medium');
              onOpenDeploy();
            }}
          >
            <Text weight="2">{t('deployContractCell')}</Text>
          </Cell>

          <Cell
            before={<Zap size={24} />}
            after={<span style={{ color: 'var(--tgui--hint_color, #707579)' }}>›</span>}
            subtitle={t('callContractDesc')}
            onClick={() => {
              tmaService.haptic('medium');
              onOpenCall();
            }}
          >
            <Text weight="2">{t('callContractCell')}</Text>
          </Cell>
        </Section>

        {/* 2. Contract History Section with Filter inside */}
        <Section header={t('contractHistory')}>
          <div>
            <div style={{ padding: '8px 16px 12px' }}>
              <SegmentedControl className="contract-history-filter">
                <SegmentedControl.Item
                  selected={filter === 'all'}
                  className={filter === 'all' ? 'contract-history-filter__item--selected' : undefined}
                  onClick={() => {
                    tmaService.haptic('selection');
                    setFilter('all');
                  }}
                >
                  {t('filterAll')}
                </SegmentedControl.Item>
                <SegmentedControl.Item
                  selected={filter === 'deploy'}
                  className={filter === 'deploy' ? 'contract-history-filter__item--selected' : undefined}
                  onClick={() => {
                    tmaService.haptic('selection');
                    setFilter('deploy');
                  }}
                >
                  {t('filterDeploy')}
                </SegmentedControl.Item>
                <SegmentedControl.Item
                  selected={filter === 'call'}
                  className={filter === 'call' ? 'contract-history-filter__item--selected' : undefined}
                  onClick={() => {
                    tmaService.haptic('selection');
                    setFilter('call');
                  }}
                >
                  {t('filterCall')}
                </SegmentedControl.Item>
              </SegmentedControl>
            </div>

            {filteredList.length === 0 ? (
              <Cell subtitle={t('noContractsHint')}>
                {t('noContractsHistory')}
              </Cell>
            ) : (
              filteredList.map((tx, i) => {
                const isDeploy = tx.type === 'deploy';
                const targetAddr = isDeploy ? (tx.to || tx.futureAddress || tx.hash) : tx.to;

                return (
                  <Cell
                    key={tx.hash || i}
                    before={
                      isDeploy ? (
                        <Rocket size={20} />
                      ) : (
                        <Zap size={20} />
                      )
                    }
                    after={
                      <Badge mode={isDeploy ? 'filled' : 'bezeled'}>
                        {isDeploy ? t('filterDeploy') : t('filterCall')}
                      </Badge>
                    }
                    subhead={formatTimestamp(tx.timestamp)}
                    subtitle={
                      isDeploy
                        ? `Contract: ${shortenAddress(targetAddr, 6, 6)}`
                        : `To: ${shortenAddress(targetAddr, 6, 6)} ${tx.data ? `• ${tx.data.slice(0, 16)}` : ''}`
                    }
                    onClick={() => {
                      tmaService.haptic('light');
                      onSelectContractItem(tx, 'contract');
                    }}
                  >
                    {isDeploy ? t('deployContractCell') : t('callContractCell')}
                  </Cell>
                );
              })
            )}
          </div>
        </Section>
      </List>
    </div>
  );
}
