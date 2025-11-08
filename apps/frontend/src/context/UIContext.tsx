import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AlertColor } from '@mui/material';

interface SnackbarState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

interface UIContextType {
  loading: boolean;
  setLoading: (state: boolean) => void;
  showMessage: (msg: string, severity?: AlertColor) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info',
  });

  const showMessage = (message: string, severity: AlertColor = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  return (
    <UIContext.Provider value={{ loading, setLoading, showMessage }}>
      {children}
      {/* Global UI elements */}
      <GlobalUI
        loading={loading}
        snackbar={snackbar}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}

/* --- Internal: GlobalUI component --- */
import { LinearProgress, Snackbar, Alert } from '@mui/material';

function GlobalUI({
  loading,
  snackbar,
  onClose,
}: {
  loading: boolean;
  snackbar: SnackbarState;
  onClose: () => void;
}) {
  return (
    <>
      {loading && (
        <LinearProgress
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2000,
          }}
        />
      )}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          sx={{ width: '100%' }}
          onClose={onClose}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
