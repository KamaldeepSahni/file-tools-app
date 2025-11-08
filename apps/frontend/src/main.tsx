import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeModeProvider } from './context/ThemeContext';
import { UIProvider } from './context/UIContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeModeProvider>
      <CssBaseline />
      <BrowserRouter>
        <UIProvider>
          <App />
        </UIProvider>
      </BrowserRouter>
    </ThemeModeProvider>
  </React.StrictMode>
);
