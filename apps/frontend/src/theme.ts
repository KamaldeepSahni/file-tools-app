import { createTheme } from '@mui/material/styles';

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#E57373' },
    secondary: { main: '#FFF176' },
    background: { default: '#FAFAFA', paper: '#FFFFFF' },
    text: { primary: '#212121' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 10, fontWeight: 500 },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          transition: 'background-color 0.3s ease, color 0.3s ease',
        },
      },
    },
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#2C5364' },
    secondary: { main: '#FFF176' },
    background: { default: '#121212', paper: '#1E1E1E' },
    text: { primary: '#E0E0E0' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          color: theme.palette.getContrastText(theme.palette.primary.main),
          backgroundColor: theme.palette.primary.main + ' !important',
        }),
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 10, fontWeight: 500 },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          transition: 'background-color 0.3s ease, color 0.3s ease',
        },
      },
    },
  },
});
