import React from 'react';

/**
 * Apple-style Telegram Emoji component.
 * Renders authentic Apple/Telegram style emojis with crisp vector SVGs and CDN assets.
 */
const EMOJI_MAP = {
  // OTS & Tokens
  coin: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1fa99.png', // 🪙
  gem: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f48e.png',  // 💎
  money: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f4b0.png', // 💰
  banknote: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f4b5.png', // 💵

  // Actions & Wallet
  wallet: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f45b.png', // 👛
  receive: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f4e5.png', // 📥
  send: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f4e4.png', // 📤
  stake: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f6e1-fe0f.png', // 🛡️
  swap: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f504.png', // 🔄
  contract: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f4dc.png', // 📜
  deploy: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f680.png', // 🚀
  call: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/26a1.png', // ⚡
  settings: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/2699-fe0f.png', // ⚙️
  lock: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f512.png', // 🔒
  unlock: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f513.png', // 🔓
  key: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f511.png', // 🔑
  shield: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f6e1-fe0f.png', // 🛡️
  check: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/2705.png', // ✅
  cross: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/274c.png', // ❌
  qr: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f4f1.png', // 📱
  copy: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f4cb.png', // 📋
  edit: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/270f-fe0f.png', // ✏️
  trash: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f5d1-fe0f.png', // 🗑️
  plus: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/2795.png', // ➕
  eye: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f441-fe0f.png', // 👁️
  sparkles: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/2728.png', // ✨
  warning: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/26a0-fe0f.png', // ⚠️
  flag_ru: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f1f7-1f1fa.png', // 🇷🇺
  flag_en: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f1ec-1f1e7.png', // 🇬🇧
  link: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f517.png', // 🔗
  up: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/2b06-fe0f.png', // ⬆️
  down: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/2b07-fe0f.png', // ⬇️
  refresh: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f504.png', // 🔄
  time: 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/img/apple/64/1f552.png' // 🕒
};

export default function TgEmoji({ name, size = 20, className = '', style = {} }) {
  const url = EMOJI_MAP[name] || EMOJI_MAP.coin;

  return (
    <span
      className={`tg-emoji ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
    >
      <img
        src={url}
        alt={name}
        loading="lazy"
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    </span>
  );
}
