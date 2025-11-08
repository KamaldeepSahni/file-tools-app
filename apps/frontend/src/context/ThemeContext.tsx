import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { lightTheme, darkTheme } from '../theme';

interface ThemeContextType {
  mode: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeModeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  // 🌓 Step 1: Detect system theme on first load (if no saved preference)
  const getInitialMode = (): 'light' | 'dark' => {
    const saved = localStorage.getItem('themeMode');
    if (saved === 'light' || saved === 'dark') return saved;

    // Detect system preference
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;
    return prefersDark ? 'dark' : 'light';
  };

  const [mode, setMode] = useState<'light' | 'dark'>(getInitialMode);

  // 📝 Step 2: Save to localStorage whenever mode changes
  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const toggleTheme = () =>
    setMode(prev => (prev === 'light' ? 'dark' : 'light'));

  const theme = useMemo(
    () => (mode === 'light' ? lightTheme : darkTheme),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={{ mode, toggleTheme }}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx)
    throw new Error('useThemeMode must be used inside ThemeModeProvider');
  return ctx;
}
