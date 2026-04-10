import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const THEMES = [
  { key: 'dark',  label: 'Dark',  icon: '🌑', preview: ['#0c0e18', '#13162a', '#4f7cff'] },
  { key: 'slate', label: 'Slate', icon: '🌘', preview: ['#1c2033', '#242840', '#6190ff'] },
  { key: 'light', label: 'Light', icon: '☀',  preview: ['#f0f2fa', '#ffffff', '#2563eb'] },
];

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('te-theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('te-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
