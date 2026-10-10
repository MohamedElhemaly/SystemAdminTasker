import React, { createContext, useContext, useState, useEffect } from 'react';

const ClickFeedbackContext = createContext({
  soundEnabled: true,
  toggleSound: () => {},
});

export const useClickFeedback = () => useContext(ClickFeedbackContext);

/**
 * Global Click Feedback Provider
 * Injects tactile active depression, visual ripple wave, cursor ping,
 * and optional synthesized physical haptic sound on every button click.
 */
export const ClickFeedbackProvider = ({ children }) => {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tasker_click_sound');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('tasker_click_sound', String(next));
      return next;
    });
  };

  useEffect(() => {
    let audioCtx = null;

    const playTactilePop = () => {
      if (!soundEnabled) return;
      try {
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        // Crisp, soft physical pop frequency (Linear/macOS style micro-tick)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(620, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, audioCtx.currentTime + 0.022);

        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.022);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.022);
      } catch (err) {
        // Audio not allowed or blocked
      }
    };

    const handlePointerDown = (e) => {
      // Find closest interactive element
      const target = e.target.closest(
        'button, [role="button"], input[type="button"], input[type="submit"], input[type="checkbox"], .clickable, .cursor-pointer'
      );

      if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') {
        return;
      }

      // 1. Play tactile sound
      playTactilePop();

      // 2. Cursor ping (expanding ring right under cursor)
      const ping = document.createElement('div');
      ping.className = 'cursor-click-wave';
      ping.style.left = `${e.clientX}px`;
      ping.style.top = `${e.clientY}px`;
      document.body.appendChild(ping);
      setTimeout(() => {
        ping.remove();
      }, 400);

      // 3. Button internal ripple effect
      if (target.tagName.toLowerCase() === 'button' || target.getAttribute('role') === 'button') {
        const rect = target.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'click-ripple';

        const size = Math.max(rect.width, rect.height) * 2.2;
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left}px`;
        ripple.style.top = `${e.clientY - rect.top}px`;

        const prevPos = target.style.position;
        const prevOverflow = target.style.overflow;

        if (window.getComputedStyle(target).position === 'static') {
          target.style.position = 'relative';
        }
        target.style.overflow = 'hidden';

        target.appendChild(ripple);

        setTimeout(() => {
          ripple.remove();
          if (prevOverflow) {
            target.style.overflow = prevOverflow;
          } else {
            target.style.removeProperty('overflow');
          }
          if (prevPos) {
            target.style.position = prevPos;
          } else if (window.getComputedStyle(target).position === 'relative' && !target.getAttribute('style')?.includes('position')) {
            target.style.removeProperty('position');
          }
        }, 460);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, { passive: true });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
    };
  }, [soundEnabled]);

  return (
    <ClickFeedbackContext.Provider value={{ soundEnabled, toggleSound }}>
      {children}
    </ClickFeedbackContext.Provider>
  );
};
