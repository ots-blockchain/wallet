import React, { useState, useEffect, useCallback, Suspense } from 'react';
import {
  AppRoot,
  Tabbar,
  FixedLayout,
  Spinner,
  Banner
} from '@telegram-apps/telegram-ui';
import { Wallet, FileCode2, Settings } from 'lucide-react';
import { Buffer } from 'buffer';
window.Buffer = Buffer;

import { I18nProvider, useI18n } from './i18n';
import SwipeableTabs from './components/SwipeableTabs';
import PinModal from './components/PinModal';
import ContextSheet from './components/ContextSheet';
import TopNotification from './components/TopNotification';

import ScreenWelcome from './screens/ScreenWelcome';
import ScreenLock from './screens/ScreenLock';
import ScreenWallet from './screens/ScreenWallet';
const ScreenContracts = React.lazy(() => import('./screens/ScreenContracts'));
import ScreenSettings from './screens/ScreenSettings';

import ModalReceive from './modals/ModalReceive';
import ModalSend from './modals/ModalSend';
import ModalStake from './modals/ModalStake';
import ModalSwap from './modals/ModalSwap';
const ModalDeploy = React.lazy(() => import('./modals/ModalDeploy'));
const ModalCall = React.lazy(() => import('./modals/ModalCall'));

import { apiService } from './services/apiService';
import { tmaService } from './services/tmaService';

const TABS = ['wallet', 'contracts', 'settings'];
const NETWORK = import.meta.env.VITE_OTS_NETWORK || (import.meta.env.PROD ? 'mainnet' : 'devnet');

function MainApp() {
  const { t } = useI18n();

  // App & Theme State
  const [theme, setTheme] = useState(() => localStorage.getItem('ots_theme') || 'auto');
  const [activeTab, setActiveTab] = useState('wallet');

  // Vault & Auth State
  const [appState, setAppState] = useState('loading'); // 'loading' | 'welcome' | 'locked' | 'unlocked'
  const [wallets, setWallets] = useState([]);
  const [activeWallet, setActiveWallet] = useState(null);
  const [unlockedPin, setUnlockedPin] = useState('');
  const [authError, setAuthError] = useState('');

  // Blockchain Data
  const [accountData, setAccountData] = useState({ balance: 0n, stake: 0n, nonce: 0 });
  const [history, setHistory] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [modalReceiveOpen, setModalReceiveOpen] = useState(false);
  const [modalSendOpen, setModalSendOpen] = useState(false);
  const [sendPrefill, setSendPrefill] = useState(null);
  const [modalStakeOpen, setModalStakeOpen] = useState(false);
  const [modalSwapOpen, setModalSwapOpen] = useState(false);
  const [modalDeployOpen, setModalDeployOpen] = useState(false);
  const [modalCallOpen, setModalCallOpen] = useState(false);
  const [callPrefillAddress, setCallPrefillAddress] = useState('');

  // Context
  const [contextSheetItem, setContextSheetItem] = useState(null);
  const [contextSheetType, setContextSheetType] = useState('transfer');

  // Top Notification Toast
  const [notificationText, setNotificationText] = useState('');
  const [addWalletOpen, setAddWalletOpen] = useState(false);
  const [pendingPinAction, setPendingPinAction] = useState(null);

  const showToast = (text) => {
    setNotificationText(text);
  };

  // 1. Theme sync
  const effectiveScheme = tmaService.getColorScheme(theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveScheme);
    document.documentElement.style.colorScheme = effectiveScheme;
  }, [effectiveScheme]);

  // 2. Initialize TMA & Check Vault on Mount
  useEffect(() => {
    tmaService.init();
    let cancelled = false;
    (async () => {
      try {
        const session = await apiService.authenticate();
        if (!cancelled) setAppState(session.hasPin ? 'locked' : 'welcome');
      } catch (error) {
        if (!cancelled) {
          setAuthError(error.message || t('error'));
          setAppState('auth_error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 3. Fetch Blockchain Data for Active Wallet
  const fetchAccountInfo = useCallback(async (wallet) => {
    if (!wallet?.id) return;
    setIsRefreshing(true);
    try {
      const [acc, hist] = await Promise.all([
        apiService.getAccount(wallet.id),
        apiService.getHistory(wallet.id)
      ]);
      setAccountData({
        ...acc,
        balance: BigInt(acc.balance || 0),
        stake: BigInt(acc.stake || 0),
        unbonding: (acc.unbonding || []).map((item) => ({ ...item, amount: BigInt(item.amount || 0) }))
      });
      setHistory(hist);
    } catch (err) {
      console.warn('Fetch data error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (appState === 'unlocked' && activeWallet) {
      fetchAccountInfo(activeWallet);
      const interval = setInterval(() => fetchAccountInfo(activeWallet), 8000);
      return () => clearInterval(interval);
    }
  }, [appState, activeWallet, fetchAccountInfo]);

  // 4. Auth callbacks
  const handleWelcomeComplete = async (initialWallet, pin) => {
    try {
      await apiService.setupPin(pin);
    } catch (error) {
      if (error.code !== 'pin_already_configured') throw error;
    }
    const walletData = initialWallet.toData();
    const createdWallet = await apiService.createWallet({
      name: initialWallet.name,
      mnemonic: walletData.mnemonic,
      privateKey: walletData.priv,
      pin
    });
    setWallets([createdWallet]);
    setActiveWallet(createdWallet);
    setUnlockedPin(pin);
    setAppState('unlocked');
    showToast(t('success'));
  };

  const handleUnlocked = async (pin) => {
    const loadedWallets = await apiService.listWallets();
    setWallets(loadedWallets);
    setActiveWallet(loadedWallets[0] || null);
    setUnlockedPin(pin);
    setAppState('unlocked');
  };

  const handleLockWallet = () => {
    setAppState('locked');
    setUnlockedPin('');
  };

  // 5. Wallet Management callbacks
  const handleSelectWallet = (rawWallet) => {
    setActiveWallet(rawWallet);
  };

  const handleRenameWallet = async (addrOrPriv, newName) => {
    const target = wallets.find((wallet) => wallet.address === addrOrPriv || wallet.id === addrOrPriv);
    if (!target) return;
    await apiService.renameWallet(target.id, newName, unlockedPin);
    const updated = wallets.map((w) => {
      if (w.id === target.id) {
        return { ...w, name: newName };
      }
      return w;
    });
    setWallets(updated);
    if (activeWallet?.id === target.id) setActiveWallet({ ...activeWallet, name: newName });
    showToast(t('done'));
  };

  const handleDeleteWallet = async (addrOrPriv) => {
    const target = wallets.find((wallet) => wallet.address === addrOrPriv || wallet.id === addrOrPriv);
    if (!target) return;
    await apiService.deleteWallet(target.id, unlockedPin);
    const updated = wallets.filter((wallet) => wallet.id !== target.id);
    setWallets(updated);
    if (activeWallet?.id === target.id) setActiveWallet(updated[0] || null);
    showToast(t('done'));
  };

  const handleReorderWallets = async (newWallets) => {
    setWallets(newWallets);
    await apiService.reorderWallets(newWallets.map((wallet) => wallet.id), unlockedPin);
  };

  const handleAddWallet = () => {
    setAddWalletOpen(true);
  };

  const handleWalletAdded = async (newWallet) => {
    if (!newWallet || !unlockedPin) {
      throw new Error(t('error'));
    }

    const walletData = newWallet.toData();
    const createdWallet = await apiService.createWallet({
      name: newWallet.name,
      mnemonic: walletData.mnemonic,
      privateKey: walletData.priv,
      pin: unlockedPin
    });
    const updated = [...wallets, createdWallet];
    setWallets(updated);
    setActiveWallet(createdWallet);
    setAddWalletOpen(false);
    showToast(t('addedWallet'));
  };

  // 6. Transaction & Smart Contract Execution Flow
  const requestPin = (action) => new Promise((resolve, reject) => {
    setPendingPinAction({ action, resolve, reject });
  });

  const submitTransaction = async (intent) => {
    if (!activeWallet) return;
    await requestPin((pin) => apiService.sendTransaction(activeWallet.id, intent, pin));
    showToast(t('success'));
    fetchAccountInfo(activeWallet);
  };

  const handleExecuteSend = ({ toAddress, amountOts, comment }) => submitTransaction({
    type: 'transfer', to: toAddress, amountOts, data: comment
  });

  const handleExecuteStake = ({ amountOts, targetAddress }) => submitTransaction({
    type: 'stake', to: targetAddress || activeWallet.address, amountOts
  });

  const handleExecuteUnstake = ({ amountOts }) => submitTransaction({ type: 'unstake', amountOts });

  const handleExecuteSwap = async ({ fromToken, toToken, fromAmount, toAmount }) => {
    tmaService.haptic('success');
    showToast(`${t('swapTitle')}: ${fromAmount} ${fromToken} → ${toAmount} ${toToken}`);
  };

  const handleExecuteDeploy = ({ compiledAst, costOts }) => submitTransaction({
    type: 'deploy', data: compiledAst, amountNano: costOts.toString()
  });

  const handleExecuteCall = ({ contractAddress, amountOts, gasLimitOts, callData }) => submitTransaction({
    type: 'call', to: contractAddress, amountOts: amountOts || '0', gasLimitOts: gasLimitOts || '1', data: callData || ''
  });

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('ots_theme', newTheme);
  };

  const isAnyModalActive = Boolean(
    modalReceiveOpen ||
    modalSendOpen ||
    modalStakeOpen ||
    modalSwapOpen ||
    modalDeployOpen ||
    modalCallOpen ||
    contextSheetItem ||
    pendingPinAction
  );

  return (
    <AppRoot appearance={effectiveScheme} platform="base">
      {NETWORK === 'devnet' && (
        <div role="status" style={{ padding: '6px 12px', textAlign: 'center', background: '#78350f', color: '#fff', fontSize: 12 }}>
          Devnet · test funds only
        </div>
      )}
      {appState === 'loading' && (
        <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
          <Spinner size="m" />
        </div>
      )}

      {appState === 'auth_error' && (
        <div style={{ padding: '32px 16px' }}>
          <Banner type="error" header="Telegram authentication required" description={authError} />
        </div>
      )}

      {appState === 'welcome' && (
        <ScreenWelcome onCompleted={handleWelcomeComplete} />
      )}

      {appState === 'locked' && (
        <ScreenLock
          onUnlocked={handleUnlocked}
          onVerifyPin={apiService.verifyPin}
        />
      )}

      {appState === 'unlocked' && (
        <div className="tma-app-container">
          {/* Swipeable Tabs Container */}
          <SwipeableTabs
            activeTab={activeTab}
            onTabChange={(tab) => {
              tmaService.haptic('selection');
              setActiveTab(tab);
            }}
            tabs={TABS}
            disabled={isAnyModalActive}
          >
            {/* Tab 1: Wallet */}
            <ScreenWallet
              wallets={wallets}
              activeWallet={activeWallet}
              onSelectWallet={handleSelectWallet}
              onRenameWallet={handleRenameWallet}
              onDeleteWallet={handleDeleteWallet}
              onReorderWallets={handleReorderWallets}
              onAddWallet={handleAddWallet}
              accountData={accountData}
              history={history}
              onRefresh={() => fetchAccountInfo(activeWallet)}
              onOpenReceive={() => setModalReceiveOpen(true)}
              onOpenSend={() => {
                setSendPrefill(null);
                setModalSendOpen(true);
              }}
              onOpenStake={() => setModalStakeOpen(true)}
              onOpenSwap={() => setModalSwapOpen(true)}
              showSwapAction={false}
              isAnyModalOpen={isAnyModalActive}
              onSelectHistoryItem={(item, type) => {
                setContextSheetItem(item);
                setContextSheetType(type);
              }}
              copiedFeedback={() => showToast(t('copied'))}
            />

            {/* Tab 2: Smart Contracts */}
            <ScreenContracts
              history={history}
              onOpenDeploy={() => setModalDeployOpen(true)}
              onOpenCall={() => {
                setCallPrefillAddress('');
                setModalCallOpen(true);
              }}
              onSelectContractItem={(item, type) => {
                setContextSheetItem(item);
                setContextSheetType(type);
              }}
            />

            {/* Tab 3: Settings */}
            <ScreenSettings
              activeWallet={activeWallet}
              onLockWallet={handleLockWallet}
              onVerifyPin={apiService.verifyPin}
              onChangePin={async (currentPin, newPin) => {
                await apiService.changePin(currentPin, newPin);
                setUnlockedPin(newPin);
              }}
            />
          </SwipeableTabs>

          {/* Separated Modern Telegram Bottom Bar */}
          <FixedLayout vertical="bottom" className="tma-tabbar-container">
            <Tabbar>
              <Tabbar.Item
                text={t('wallet')}
                selected={activeTab === 'wallet'}
                onClick={() => {
                  tmaService.haptic('selection');
                  setActiveTab('wallet');
                }}
              >
                <Wallet size={22} />
              </Tabbar.Item>

              <Tabbar.Item
                text={t('contracts')}
                selected={activeTab === 'contracts'}
                onClick={() => {
                  tmaService.haptic('selection');
                  setActiveTab('contracts');
                }}
              >
                <FileCode2 size={22} />
              </Tabbar.Item>

              <Tabbar.Item
                text={t('settings')}
                selected={activeTab === 'settings'}
                onClick={() => {
                  tmaService.haptic('selection');
                  setActiveTab('settings');
                }}
              >
                <Settings size={22} />
              </Tabbar.Item>
            </Tabbar>
          </FixedLayout>

          {/* Modals */}
          <ModalReceive
            open={modalReceiveOpen}
            onClose={() => setModalReceiveOpen(false)}
            address={activeWallet?.address || ''}
            onCopy={() => showToast(t('copied'))}
          />

          <ModalSend
            open={modalSendOpen}
            onClose={() => setModalSendOpen(false)}
            activeWallet={activeWallet}
            availableBalance={accountData.balance}
            onConfirmSend={handleExecuteSend}
            prefill={sendPrefill}
          />

          <ModalStake
            open={modalStakeOpen}
            onClose={() => setModalStakeOpen(false)}
            activeWallet={activeWallet}
            availableBalance={accountData.balance}
            stakedBalance={accountData.stake}
            unbonding={accountData.unbonding || []}
            currentBlockIndex={accountData.currentBlockIndex || 0}
            onConfirmStake={handleExecuteStake}
            onConfirmUnstake={handleExecuteUnstake}
          />

          <ModalSwap
            open={modalSwapOpen}
            onClose={() => setModalSwapOpen(false)}
            activeWallet={activeWallet}
            availableBalance={accountData.balance}
            onConfirmSwap={handleExecuteSwap}
          />

          <ModalDeploy
            open={modalDeployOpen}
            onClose={() => setModalDeployOpen(false)}
            activeWallet={activeWallet}
            availableBalance={accountData.balance}
            currentNonce={accountData.nonce}
            onConfirmDeploy={handleExecuteDeploy}
          />

          <ModalCall
            open={modalCallOpen}
            onClose={() => setModalCallOpen(false)}
            activeWallet={activeWallet}
            availableBalance={accountData.balance}
            onConfirmCall={handleExecuteCall}
            prefillAddress={callPrefillAddress}
          />

          {/* Context Action Sheet */}
          <ContextSheet
            open={!!contextSheetItem}
            onClose={() => setContextSheetItem(null)}
            item={contextSheetItem}
            type={contextSheetType}
            onRepeatTransfer={(tx) => {
              setSendPrefill({ to: tx.to, amount: tx.amount });
              setModalSendOpen(true);
            }}
            onCallContract={(tx) => {
              const addr = tx.type === 'deploy' ? (tx.to || tx.futureAddress || tx.hash) : tx.to;
              setCallPrefillAddress(addr);
              setModalCallOpen(true);
            }}
            onCopyHash={() => showToast(t('copied'))}
          />
        </div>
      )}

      {appState === 'unlocked' && addWalletOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <ScreenWelcome
            onWalletAdded={handleWalletAdded}
            onCancel={() => setAddWalletOpen(false)}
          />
        </div>
      )}

      <PinModal
        open={Boolean(pendingPinAction)}
        title={t('enterPinToUnlock')}
        onVerify={() => Promise.resolve()}
        onSuccess={async (pin) => {
          const pending = pendingPinAction;
          if (!pending) return;
          try {
            const result = await pending.action(pin);
            pending.resolve(result);
            setPendingPinAction(null);
          } catch (error) {
            throw error;
          }
        }}
        onClose={() => {
          if (pendingPinAction) pendingPinAction.reject(new Error('PIN confirmation cancelled'));
          setPendingPinAction(null);
        }}
      />

      {/* Top Notification Toast */}
      <TopNotification
        message={notificationText}
        onClose={() => setNotificationText('')}
      />
    </AppRoot>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <Suspense fallback={<div style={{ padding: 24 }}>Loading wallet…</div>}>
        <MainApp />
      </Suspense>
    </I18nProvider>
  );
}
