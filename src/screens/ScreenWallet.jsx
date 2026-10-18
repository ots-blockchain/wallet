import React, { useState, useRef, useEffect } from 'react';
import {
  List,
  Section,
  Cell,
  Text,
  Button,
  Modal,
  Input,
  Badge,
  Spinner
} from '@telegram-apps/telegram-ui';
import { ArrowDownLeft, ArrowUpRight, ShieldCheck, ArrowLeftRight, Copy, Edit3, Trash2, Clock } from 'lucide-react';
import { useI18n } from '../i18n';
import { tmaService } from '../services/tmaService';
import { shortenAddress, formatOtsAmount, formatTimestamp } from '../utils/format';
import ModalConfirm from '../components/ModalConfirm';
import ActionButton from '../components/ActionButton';

export default function ScreenWallet({
  wallets,
  activeWallet,
  onSelectWallet,
  onRenameWallet,
  onDeleteWallet,
  onReorderWallets,
  onAddWallet,
  accountData,
  history,
  onRefresh,
  onOpenReceive,
  onOpenSend,
  onOpenStake,
  onOpenSwap,
  showSwapAction = false,
  isAnyModalOpen = false,
  onSelectHistoryItem,
  copiedFeedback
}) {
  const { t } = useI18n();
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [selectedWalletForAction, setSelectedWalletForAction] = useState(null);
  const [newWalletName, setNewWalletName] = useState('');
  const [walletToDelete, setWalletToDelete] = useState(null);
  const [pageLimit, setPageLimit] = useState(15);
  const listRef = useRef(null);

  // Pull to refresh state
  const [pullProgress, setPullProgress] = useState(0); // 0 -> 1+
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const isPullingRef = useRef(false);
  const gestureLockRef = useRef(null); // null | 'pull' | 'scroll' | 'horizontal'
  const hapticTriggeredRef = useRef(false);

  // Drag reordering state for wallets
  const [draggedIdx, setDraggedIdx] = useState(null);
  const dragStartYRef = useRef(0);
  const currentOrderRef = useRef(wallets);
  const isDraggingRef = useRef(false);
  const walletLongPressTimeoutRef = useRef(null);
  const walletLongPressTriggeredRef = useRef(false);

  useEffect(() => {
    currentOrderRef.current = wallets;
  }, [wallets]);

  useEffect(() => () => {
    clearTimeout(walletLongPressTimeoutRef.current);
  }, []);

  const clearWalletLongPress = () => {
    clearTimeout(walletLongPressTimeoutRef.current);
    walletLongPressTimeoutRef.current = null;
  };

  const handleWalletLongPressStart = (wallet, event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    clearWalletLongPress();
    walletLongPressTriggeredRef.current = false;
    walletLongPressTimeoutRef.current = setTimeout(() => {
      walletLongPressTriggeredRef.current = true;
      tmaService.haptic('medium');
      setSelectedWalletForAction(wallet);
    }, 550);
  };

  const handleDragStart = (idx, e) => {
    if (e) {
      e.stopPropagation();
    }
    isDraggingRef.current = true;
    tmaService.haptic('medium');
    setDraggedIdx(idx);
    dragStartYRef.current = e.touches ? e.touches[0].clientY : e.clientY;
    currentOrderRef.current = [...wallets];
  };

  const handleDragMove = (e) => {
    if (draggedIdx === null) return;
    if (e) {
      e.stopPropagation();
    }
    const currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const diffY = currentY - dragStartYRef.current;
    const itemsMoved = Math.round(diffY / 54);
    const newIdx = Math.max(0, Math.min(wallets.length - 1, draggedIdx + itemsMoved));

    if (newIdx !== draggedIdx) {
      const updated = [...currentOrderRef.current];
      const [movedItem] = updated.splice(draggedIdx, 1);
      updated.splice(newIdx, 0, movedItem);
      currentOrderRef.current = updated;
      setDraggedIdx(newIdx);
      dragStartYRef.current = currentY;
      tmaService.haptic('selection');
      if (onReorderWallets) {
        onReorderWallets(updated);
      }
    }
  };

  const handleDragEnd = (e) => {
    if (e) {
      e.stopPropagation();
    }
    if (draggedIdx !== null) {
      setDraggedIdx(null);
      tmaService.haptic('light');
    }
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };

  // Helper to check if any modal or drawer is active
  const checkIsModalActive = () => {
    return Boolean(
      isAnyModalOpen ||
      walletSelectorOpen ||
      renameModalOpen ||
      walletToDelete ||
      selectedWalletForAction ||
      document.querySelector('[data-vaul-overlay]') ||
      document.querySelector('[data-vaul-drawer][data-state="open"]') ||
      document.querySelector('.tgui-3197096cb603b35a')
    );
  };

  // Filter transfers specifically (type !== 'deploy' && type !== 'call')
  const transferHistory = history.filter(
    (tx) => tx.type === 'transfer' || tx.type === 'stake' || tx.type === 'unstake' || !tx.type
  );

  const displayedTransfers = transferHistory.slice(0, pageLimit);
  const hasMore = transferHistory.length > pageLimit;

  // Infinite scroll
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 60 && hasMore) {
      setPageLimit((prev) => prev + 15);
    }
  };

  const PULL_THRESHOLD = 70; // px
  const TARGET_TOP = 64; // resting position ~1/6 screen height (around 64-74px)

  // Pull to refresh touch handlers
  const handleTouchStart = (e) => {
    if (checkIsModalActive()) {
      isPullingRef.current = false;
      return;
    }

    if (listRef.current && listRef.current.scrollTop <= 0 && !isRefreshing && !isDismissing) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
      isPullingRef.current = true;
      gestureLockRef.current = null;
      hapticTriggeredRef.current = false;
    } else {
      isPullingRef.current = false;
    }
  };

  const handleTouchMove = (e) => {
    if (!isPullingRef.current || isRefreshing || isDismissing || checkIsModalActive()) {
      if (isPullingRef.current) {
        isPullingRef.current = false;
        setPullProgress(0);
      }
      return;
    }
    if (listRef.current && listRef.current.scrollTop > 0) {
      isPullingRef.current = false;
      setPullProgress(0);
      return;
    }

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - touchStartRef.current.x;
    const dy = currentY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!gestureLockRef.current) {
      if (absX > 8 || absY > 8) {
        if (absX > absY) {
          // Horizontal gesture -> abort pull so SwipeableTabs handles tab switching
          gestureLockRef.current = 'horizontal';
          isPullingRef.current = false;
          setPullProgress(0);
          return;
        } else if (dy > 0) {
          gestureLockRef.current = 'pull';
        } else {
          gestureLockRef.current = 'scroll';
          isPullingRef.current = false;
          return;
        }
      } else {
        return;
      }
    }

    if (gestureLockRef.current === 'pull') {
      if (dy <= 0) {
        setPullProgress(0);
        return;
      }
      // Apply rubber band damping
      const distance = Math.min(dy * 0.48, 105);
      const progress = Math.min(distance / PULL_THRESHOLD, 1.3);
      setPullProgress(progress);

      if (progress >= 1.0 && !hapticTriggeredRef.current) {
        hapticTriggeredRef.current = true;
        tmaService.haptic('light');
      } else if (progress < 1.0 && hapticTriggeredRef.current) {
        hapticTriggeredRef.current = false;
      }
    }
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current || isRefreshing || isDismissing) return;
    isPullingRef.current = false;

    if (pullProgress >= 1.0 && !isRefreshing) {
      setIsRefreshing(true);
      tmaService.haptic('medium');

      try {
        if (onRefresh) await onRefresh();
      } catch (err) {
        console.warn('Refresh error:', err);
      } finally {
        // Dismiss in place with scale(0) and opacity(0)
        setIsDismissing(true);
        setTimeout(() => {
          setIsRefreshing(false);
          setIsDismissing(false);
          setPullProgress(0);
          gestureLockRef.current = null;
        }, 260);
      }
    } else {
      setPullProgress(0);
      gestureLockRef.current = null;
    }
  };

  const handleCopyAddress = () => {
    if (activeWallet?.address) {
      tmaService.haptic('light');
      tmaService.copyText(activeWallet.address);
      if (copiedFeedback) copiedFeedback();
    }
  };

  const handleOpenWalletAction = (wallet) => {
    tmaService.haptic('medium');
    setSelectedWalletForAction(wallet);
  };

  const handleSaveRename = () => {
    if (selectedWalletForAction && newWalletName.trim()) {
      onRenameWallet(selectedWalletForAction.address || selectedWalletForAction.priv, newWalletName.trim());
      setRenameModalOpen(false);
      setSelectedWalletForAction(null);
      setNewWalletName('');
    }
  };

  const handleMoveWallet = (index, direction) => {
    tmaService.haptic('light');
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= wallets.length) return;

    const updated = [...wallets];
    const item = updated.splice(index, 1)[0];
    updated.splice(targetIdx, 0, item);
    if (onReorderWallets) onReorderWallets(updated);
  };

  // Dynamic values for floating circular indicator
  const currentTop = isDismissing || isRefreshing ? TARGET_TOP : 8 + (TARGET_TOP - 8) * Math.min(pullProgress, 1.15);
  const circleScale = isDismissing ? 0 : isRefreshing ? 1 : Math.min(Math.max(pullProgress * 1.05, 0), 1);
  const circleOpacity = isDismissing ? 0 : (pullProgress > 0.05 || isRefreshing) ? 1 : 0;
  const arrowOpacity = (isRefreshing || isDismissing) ? 0 : Math.min(Math.max((pullProgress - 0.12) / 0.72, 0), 1);
  const arrowRotation = Math.min(pullProgress, 1.25) * 360;
  const spinnerOpacity = (isRefreshing && !isDismissing) ? 1 : 0;

  return (
    <div
      className="tma-screen-content animate-fade-in"
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      ref={listRef}
      style={{ padding: '0 0 24px', position: 'relative' }}
    >
      {/* Floating pull-to-refresh circle (does NOT displace page content) */}
      {(pullProgress > 0.05 || isRefreshing || isDismissing) && (
        <div
          style={{
            position: 'absolute',
            top: `${currentTop}px`,
            left: '50%',
            transform: `translateX(-50%) scale(${circleScale})`,
            opacity: circleOpacity,
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            backgroundColor: 'var(--tgui--text_color, #ffffff)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.28)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            pointerEvents: 'none',
            transition: isPullingRef.current
              ? 'none'
              : 'transform 0.26s cubic-bezier(0.34, 1.3, 0.64, 1), opacity 0.24s ease, top 0.24s cubic-bezier(0.34, 1.2, 0.64, 1)'
          }}
        >
          {/* Circular clockwise arrow with rotate and fade */}
          <div
            style={{
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: arrowOpacity,
              transform: `rotate(${arrowRotation}deg)`,
              transition: isPullingRef.current ? 'none' : 'opacity 0.2s ease, transform 0.2s ease',
              color: 'var(--tgui--link_color, #2481cc)'
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M 12 19.5 A 7.5 7.5 0 1 1 19.5 12"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <polygon
                points="16.5,11 22.5,11 19.5,16"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="0.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Spinner during refresh */}
          <div
            style={{
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: spinnerOpacity,
              transition: 'opacity 0.2s ease',
              color: 'var(--tgui--link_color, #2481cc)'
            }}
          >
            <svg
              style={{
                width: '20px',
                height: '20px',
                animation: 'spin 0.75s linear infinite'
              }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <circle
                cx="12"
                cy="12"
                r="7.5"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="32 15"
              />
            </svg>
          </div>
        </div>
      )}

      {/* 1. Top Bar: Centered Wallet Selector Dropdown */}
      <div
        style={{
          padding: '12px 16px 6px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%'
        }}
      >
        <div
          onClick={() => {
            tmaService.haptic('light');
            setWalletSelectorOpen(true);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            backgroundColor: 'var(--tgui--plain_background, rgba(128, 128, 128, 0.12))',
            borderRadius: '20px',
            cursor: 'pointer',
            border: '1px solid var(--tgui--outline, rgba(255, 255, 255, 0.06))'
          }}
        >
          <Text weight="2" style={{ fontSize: '14px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeWallet?.name || 'Wallet'}
          </Text>
          <span style={{ fontSize: '10px', color: 'var(--tgui--hint_color, #707579)' }}>▼</span>
        </div>
      </div>

      {/* 2. Main Balance Header (Clean typography without 700 bold) */}
      <div style={{ padding: '16px 16px 20px', textAlign: 'center' }}>
        <Text style={{ color: 'var(--tgui--hint_color, #707579)', fontSize: 'var(--tgui--text--font_size)', display: 'block', marginBottom: '6px' }}>
          {t('mainBalance')}
        </Text>

        <div
          style={{
            fontSize: '40px',
            fontWeight: '500',
            lineHeight: '1.1',
            marginBottom: '8px',
            letterSpacing: '-0.5px',
            color: 'var(--tgui--text_color, #ffffff)'
          }}
        >
          {formatOtsAmount(accountData.balance)} <span style={{ fontSize: '28px', fontWeight: '400', color: 'var(--tgui--hint_color, #888888)' }}>OTS</span>
        </div>

        {accountData.stake > 0n && (
          <Text style={{ color: 'var(--tgui--accent_green, #34c759)', fontSize: '14px', display: 'block', marginBottom: '10px' }}>
            +{formatOtsAmount(accountData.stake)} OTS {t('stakedBalance').toLowerCase()}
          </Text>
        )}

        {/* Shortened Base58 Address Copy Badge (Neutral, no blue tint) */}
        <div style={{ display: 'inline-flex', justifyContent: 'center' }}>
          <div
            onClick={handleCopyAddress}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
          >
            <span className="monospace-text" style={{ fontSize: '14px', color: 'var(--tgui--hint_color, #aaaaaa)' }}>
              {shortenAddress(activeWallet?.address, 6, 6)}
            </span>
            <Copy size={13} />
          </div>
        </div>
      </div>

      {/* 3. Circular Action Buttons with Label underneath */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          padding: '4px 16px 24px'
        }}
      >
        <ActionButton
          icon={<ArrowDownLeft size={24} />}
          label={t('receive')}
          onClick={onOpenReceive}
        />
        <ActionButton
          icon={<ArrowUpRight size={24} />}
          label={t('send')}
          onClick={onOpenSend}
        />
        <ActionButton
          icon={<ShieldCheck size={24} />}
          label={t('stake')}
          onClick={onOpenStake}
        />
        {showSwapAction && (
          <ActionButton
            icon={<ArrowLeftRight size={24} />}
            label={t('swap')}
            onClick={onOpenSwap}
          />
        )}
      </div>

      {/* 4. Transfer History Section */}
      <List>
        <Section header={t('transferHistory')}>
          {displayedTransfers.length === 0 ? (
            <Cell subtitle={t('noTransfersHint')}>
              {t('noTransfers')}
            </Cell>
          ) : (
            displayedTransfers.map((tx, idx) => {
              const isOutgoing = tx.from === activeWallet?.publicKey || tx.from === activeWallet?.address;
              const isStake = tx.type === 'stake';
              const isUnstake = tx.type === 'unstake';

              return (
                <Cell
                  key={tx.hash || idx}
                  before={
                    isStake ? (
                      <ShieldCheck size={20} />
                    ) : isUnstake ? (
                      <Clock size={20} style={{ color: 'var(--tgui--link_color, #2481cc)' }} />
                    ) : isOutgoing ? (
                      <ArrowUpRight size={20} />
                    ) : (
                      <ArrowDownLeft size={20} />
                    )
                  }
                  after={
                    <span
                      style={{
                        fontWeight: '600',
                        fontSize: '14px',
                        color: isStake || isUnstake
                          ? 'var(--tgui--accent_green, #34c759)'
                          : isOutgoing
                            ? 'var(--tgui--destructive_text_color, #ef4444)'
                            : 'var(--tgui--accent_green, #34c759)'
                      }}
                    >
                      {isOutgoing && !isUnstake ? '-' : '+'}{formatOtsAmount(tx.amount)} OTS
                    </span>
                  }
                  subhead={formatTimestamp(tx.timestamp)}
                  subtitle={
                    tx.data ? tx.data : (isOutgoing ? `To: ${shortenAddress(tx.to, 4, 4)}` : `From: ${shortenAddress(tx.from, 4, 4)}`)
                  }
                  onClick={() => {
                    tmaService.haptic('light');
                    onSelectHistoryItem(tx, 'transfer');
                  }}
                >
                  {isStake ? t('stakeTransfer') : isUnstake ? t('unstakeTx') : isOutgoing ? t('outgoingTransfer') : t('incomingTransfer')}
                </Cell>
              );
            })
          )}
        </Section>
      </List>

      {/* Complete Wallet Management Dropdown Modal */}
      <Modal
        open={walletSelectorOpen}
        onOpenChange={(isOpen) => setWalletSelectorOpen(isOpen)}
        header={<Modal.Header />}
      >
        <div style={{ padding: '0 0 24px' }}>
          <List>
            <Section header={t('walletsManagement')}>
              {wallets.map((w, index) => {
                const isSelected = (w.address || w.priv) === (activeWallet?.address || activeWallet?.priv);

                return (
                  <Cell
                    key={w.address || w.priv || index}
                    subtitle={shortenAddress(w.address, 6, 6)}
                    style={{
                      touchAction: draggedIdx !== null ? 'none' : 'auto',
                      backgroundColor: draggedIdx === index ? 'var(--tgui--secondary_fill, rgba(255, 255, 255, 0.08))' : 'transparent',
                      transition: 'background-color 0.15s ease'
                    }}
                    onPointerDown={(event) => handleWalletLongPressStart(w, event)}
                    onPointerUp={clearWalletLongPress}
                    onPointerCancel={clearWalletLongPress}
                    onPointerLeave={clearWalletLongPress}
                    onPointerMove={clearWalletLongPress}
                    after={
                      <div
                        style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {isSelected && <Badge mode="filled">{t('active')}</Badge>}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleOpenWalletAction(w);
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                          }}
                          style={{
                            position: 'relative',
                            zIndex: 11,
                            background: 'transparent',
                            border: 'none',
                            padding: '6px 8px',
                            cursor: 'pointer',
                            color: 'var(--tgui--hint_color, #707579)',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            outline: 'none',
                            userSelect: 'none'
                          }}
                        >
                          •••
                        </button>
                        <div
                          onTouchStart={(e) => handleDragStart(index, e)}
                          onTouchMove={handleDragMove}
                          onTouchEnd={handleDragEnd}
                          onMouseDown={(e) => handleDragStart(index, e)}
                          onMouseMove={handleDragMove}
                          onMouseUp={handleDragEnd}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                          }}
                          style={{
                            position: 'relative',
                            zIndex: 11,
                            padding: '8px 6px',
                            cursor: 'grab',
                            color: 'var(--tgui--hint_color, #707579)',
                            display: 'flex',
                            alignItems: 'center',
                            touchAction: 'none',
                            userSelect: 'none'
                          }}
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          >
                            <line x1="4" y1="7" x2="20" y2="7" />
                            <line x1="4" y1="12" x2="20" y2="12" />
                            <line x1="4" y1="17" x2="20" y2="17" />
                          </svg>
                        </div>
                      </div>
                    }
                    onClick={(e) => {
                      if (walletLongPressTriggeredRef.current) {
                        walletLongPressTriggeredRef.current = false;
                        e?.preventDefault();
                        e?.stopPropagation();
                        return;
                      }
                      if (isDraggingRef.current || draggedIdx !== null) {
                        e?.stopPropagation();
                        return;
                      }
                      onSelectWallet(w);
                      setWalletSelectorOpen(false);
                    }}
                  >
                    {w.name || `Wallet ${index + 1}`}
                  </Cell>
                );
              })}
            </Section>

            <Section>
              <Cell
                onClick={() => {
                  setWalletSelectorOpen(false);
                  onAddWallet();
                }}
              >
                + {t('addWallet')}
              </Cell>
            </Section>
          </List>
        </div>
      </Modal>

      {/* Wallet Action Options Sheet */}
      <Modal
        open={!!selectedWalletForAction && !renameModalOpen}
        onOpenChange={(isOpen) => !isOpen && setSelectedWalletForAction(null)}
        header={<Modal.Header />}
      >
        <div style={{ padding: '0 0 24px' }}>
          <List>
            <Section header={selectedWalletForAction?.name || t('activeWallet')}>
              <Cell
                before={<Edit3 size={18} />}
                onClick={() => {
                  setNewWalletName(selectedWalletForAction?.name || '');
                  setRenameModalOpen(true);
                }}
              >
                {t('renameWallet')}
              </Cell>

              <Cell
                before={<Trash2 size={18} />}
                onClick={() => {
                  setWalletToDelete(selectedWalletForAction);
                  setSelectedWalletForAction(null);
                }}
              >
                <Text style={{ color: 'var(--tgui--destructive_text_color, #ef4444)' }}>
                  {t('deleteWallet')}
                </Text>
              </Cell>
            </Section>
          </List>
        </div>
      </Modal>

      {/* Rename Wallet Modal */}
      <Modal
        open={renameModalOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setRenameModalOpen(false);
            setSelectedWalletForAction(null);
          }
        }}
        header={<Modal.Header />}
      >
        <div style={{ padding: '16px 20px 28px' }}>
          <div style={{ marginBottom: '16px', textAlign: 'center' }}>
            <Text weight="2" style={{ fontSize: '18px' }}>
              {t('renameWallet')}
            </Text>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <Input
              value={newWalletName}
              onChange={(e) => setNewWalletName(e.target.value)}
              placeholder={t('walletNamePrompt')}
              autoFocus
            />
          </div>
          <Button size="l" mode="filled" stretched onClick={handleSaveRename}>
            {t('done')}
          </Button>
        </div>
      </Modal>

      {/* Delete Wallet Confirm Modal */}
      <ModalConfirm
        open={!!walletToDelete}
        onClose={() => setWalletToDelete(null)}
        onConfirm={() => {
          if (walletToDelete) {
            onDeleteWallet(walletToDelete.address || walletToDelete.priv);
            setWalletToDelete(null);
          }
        }}
        title={t('deleteWallet')}
        description={t('deleteWalletConfirm')}
        confirmText={t('deleteWallet')}
        cancelText={t('cancel')}
        isDestructive={true}
      />
    </div>
  );
}
