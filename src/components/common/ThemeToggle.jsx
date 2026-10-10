import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle = ({ isCollapsed }) => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'light') return false;
      if (savedTheme === 'dark') return true;
      return !window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    return true;
  });

  // Keep DOM synchronized with isDark state
  useEffect(() => {
    document.documentElement.classList.remove('light');
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const applyThemeChange = (nextIsDark) => {
    // Add temporary global transition class for smooth 450ms color blending
    document.documentElement.classList.add('theme-transitioning');

    if (nextIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    setIsDark(nextIsDark);

    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 480);
  };

  const handleToggle = (e) => {
    const nextIsDark = !isDark;

    // If View Transitions API is not supported or user prefers reduced motion, use smooth fallback
    if (
      !document.startViewTransition ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      applyThemeChange(nextIsDark);
      return;
    }

    // Coordinates of click event or button center
    const rect = e.currentTarget?.getBoundingClientRect();
    const x = e.clientX || (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
    const y = e.clientY || (rect ? rect.top + rect.height / 2 : window.innerHeight / 2);

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = document.startViewTransition(() => {
      applyThemeChange(nextIsDark);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`
          ]
        },
        {
          duration: 480,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      );
    });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-[#28292f] hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-all border border-slate-200 dark:border-slate-700/60 shadow-xs cursor-pointer select-none group"
      title={isDark ? "Switch to Classic Light Mode" : "Switch to Dark Mode"}
    >
      {/* Animated 360° Rotating Flip Icon Container */}
      <div className="relative w-4 h-4 shrink-0 flex items-center justify-center">
        <Sun
          className={`w-4 h-4 text-amber-400 absolute transition-all duration-300 transform ${
            isDark
              ? 'opacity-100 rotate-0 scale-100'
              : 'opacity-0 -rotate-90 scale-50'
          }`}
        />
        <Moon
          className={`w-4 h-4 text-indigo-500 dark:text-indigo-400 absolute transition-all duration-300 transform ${
            !isDark
              ? 'opacity-100 rotate-0 scale-100'
              : 'opacity-0 rotate-90 scale-50'
          }`}
        />
      </div>

      {!isCollapsed && (
        <span className="truncate transition-opacity duration-200">
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
};
