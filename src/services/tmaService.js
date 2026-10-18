/**
 * Telegram Mini App Service integration.
 * Wraps TMA WebApp SDK, haptics, theme sync, and QR scanner.
 */

class TmaService {
  constructor() {
    this.tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
  }

  init() {
    if (!this.tg) return;

    try {
      this.tg.ready();
      this.tg.expand();
      if (this.tg.disableVerticalSwipes) {
        this.tg.disableVerticalSwipes();
      }
      if (this.tg.enableClosingConfirmation) {
        this.tg.enableClosingConfirmation();
      }
    } catch (e) {
      console.warn('[TMA] Init error:', e);
    }
  }

  getInitData() {
    return this.tg?.initData || '';
  }

  getUser() {
    return this.tg?.initDataUnsafe?.user || null;
  }

  getColorScheme(userTheme = 'auto') {
    if (userTheme === 'dark') return 'dark';
    if (userTheme === 'light') return 'light';
    return this.tg?.colorScheme || 'dark';
  }

  haptic(type = 'light') {
    if (!this.tg?.HapticFeedback) return;
    try {
      if (type === 'light' || type === 'medium' || type === 'heavy' || type === 'rigid' || type === 'soft') {
        this.tg.HapticFeedback.impactOccurred(type);
      } else if (type === 'success' || type === 'warning' || type === 'error') {
        this.tg.HapticFeedback.notificationOccurred(type);
      } else if (type === 'selection') {
        this.tg.HapticFeedback.selectionChanged();
      }
    } catch {}
  }

  scanQr(title = 'Scan Address QR') {
    return new Promise((resolve) => {
      if (!this.tg?.showScanQrPopup) {
        resolve(null);
        return;
      }

      this.tg.showScanQrPopup({ text: title }, (data) => {
        if (data) {
          this.tg.closeScanQrPopup();
          resolve(data.trim());
          return true;
        }
        return false;
      });
    });
  }

  copyText(text) {
    if (navigator.clipboard) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.resolve();
  }

  openLink(url) {
    if (this.tg?.openLink) {
      this.tg.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  }
}

export const tmaService = new TmaService();
