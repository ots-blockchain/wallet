import React, { useRef, useState } from 'react';

/**
 * SwipeableTabs component.
 * Allows smooth touch swipe gestures between tabs in addition to Tabbar taps.
 * Automatically disables swipe gestures when any modal or sheet is open.
 */
export default function SwipeableTabs({ activeTab, onTabChange, tabs, disabled = false, children }) {
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const gestureLockRef = useRef(null); // null | 'horizontal' | 'vertical'
  const [touchDelta, setTouchDelta] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const currentIndex = tabs.indexOf(activeTab);

  const checkIsModalActive = () => {
    if (disabled) return true;
    if (typeof document === 'undefined') return false;
    return Boolean(
      document.querySelector('[data-vaul-overlay]') ||
      document.querySelector('[data-vaul-drawer][data-state="open"]') ||
      document.querySelector('.tgui-3197096cb603b35a') ||
      document.querySelector('.tgui-cc76354712c6e8d9') ||
      document.querySelector('[role="dialog"]')
    );
  };

  const handleTouchStart = (e) => {
    if (checkIsModalActive()) {
      gestureLockRef.current = 'vertical';
      setIsSwiping(false);
      return;
    }

    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
    gestureLockRef.current = null;
    setIsSwiping(false);
  };

  const handleTouchMove = (e) => {
    if (checkIsModalActive() || gestureLockRef.current === 'vertical') {
      if (isSwiping) {
        setIsSwiping(false);
        setTouchDelta(0);
      }
      return;
    }

    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // Determine direction lock once movement exceeds threshold
    if (!gestureLockRef.current) {
      if (absX > 8 || absY > 8) {
        if (absX > absY) {
          gestureLockRef.current = 'horizontal';
          setIsSwiping(true);
        } else {
          gestureLockRef.current = 'vertical';
          setIsSwiping(false);
          setTouchDelta(0);
          return;
        }
      } else {
        return;
      }
    }

    if (gestureLockRef.current === 'horizontal') {
      // Add slight resistance at edges
      if ((currentIndex === 0 && dx > 0) || (currentIndex === tabs.length - 1 && dx < 0)) {
        setTouchDelta(dx * 0.25);
      } else {
        setTouchDelta(dx);
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (checkIsModalActive() || gestureLockRef.current === 'vertical') {
      gestureLockRef.current = null;
      setIsSwiping(false);
      setTouchDelta(0);
      return;
    }

    const wasHorizontal = gestureLockRef.current === 'horizontal';
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dt = Date.now() - touchStartRef.current.time;
    const velocity = Math.abs(dx) / (dt || 1);

    gestureLockRef.current = null;
    setIsSwiping(false);
    setTouchDelta(0);

    if (!wasHorizontal) return;

    // If swipe distance is > 60px or flick velocity > 0.4
    if (Math.abs(dx) > 60 || velocity > 0.4) {
      if (dx < 0 && currentIndex < tabs.length - 1) {
        onTabChange(tabs[currentIndex + 1]);
      } else if (dx > 0 && currentIndex > 0) {
        onTabChange(tabs[currentIndex - 1]);
      }
    }
  };

  return (
    <div
      className="swipeable-tabs-wrapper"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {React.Children.map(children, (child, index) => {
        const isActive = index === currentIndex;
        return (
          <div
            key={tabs[index] || index}
            style={{
              minWidth: '100%',
              width: '100%',
              height: '100%',
              transform: `translateX(calc(${(index - currentIndex) * 100}% + ${touchDelta}px))`,
              transition: isSwiping ? 'none' : 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)',
              position: 'absolute',
              top: 0,
              left: 0,
              pointerEvents: isActive ? 'auto' : 'none',
              opacity: isActive || isSwiping ? 1 : 0
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
