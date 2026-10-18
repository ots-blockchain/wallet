import React, { useState } from 'react';
import { tmaService } from '../services/tmaService';

/**
 * ActionButton - circular icon button with label below (used for Receive, Send, Stake, Swap).
 */
export default function ActionButton({
  icon,
  label,
  onClick,
  disabled = false,
  color = 'var(--tgui--button_color, #2481cc)',
  textColor = 'var(--tgui--button_text_color, #ffffff)',
  labelColor = 'var(--tgui--hint_color, #707579)'
}) {
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = (e) => {
    if (disabled) return;
    tmaService.haptic('medium');
    if (onClick) onClick(e);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onTouchCancel={() => setIsPressed(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        background: 'transparent',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
        outline: 'none',
        opacity: disabled ? 0.5 : 1,
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          backgroundColor: color,
          color: textColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: isPressed ? 'scale(0.92)' : 'scale(1)',
          transition: 'transform 0.15s cubic-bezier(0.2, 0, 0, 1)',
          boxShadow: isPressed ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.08)'
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize: '12px',
          fontWeight: '500',
          color: labelColor,
          textAlign: 'center',
          whiteSpace: 'nowrap'
        }}
      >
        {label}
      </span>
    </button>
  );
}
