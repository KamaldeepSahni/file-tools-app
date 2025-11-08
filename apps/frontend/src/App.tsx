import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Stack,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Box,
} from '@mui/material';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useThemeMode } from './context/ThemeContext';
import { Brightness4, Brightness7, ArrowDropDown } from '@mui/icons-material';

import HomeDashboard from './pages/HomeDashboard';

import ImagesToPdf from './pages/tools/other/ImagesToPdf';
import PdfToImages from './pages/tools/other/PdfToImages';
import SplitPdf from './pages/tools/pdf/SplitPdf';
import SplitVideo from './pages/tools/video/SplitVideo';
import ZipConvert from './pages/tools/other/ZipConvert';
import UnlockPdf from './pages/tools/pdf/UnlockPdf';
import MergePdf from './pages/tools/pdf/MergePdf';
import ReorganizePdf from './pages/tools/pdf/ReorganizePdf';
import TrimVideo from './pages/tools/video/TrimVideo';

export default function App() {
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuType, setMenuType] = useState<string | null>(null);

  // open menu on click
  const handleMenuClick = (
    event: React.MouseEvent<HTMLElement>,
    type: string
  ) => {
    setAnchorEl(event.currentTarget);
    setMenuType(type);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuType(null);
  };

  // new grouped menu config
  const menus = {
    pdf: [
      { name: 'Split PDF', path: '/tools/pdf/split' },
      { name: 'Merge PDFs', path: '/tools/pdf/merge' },
      { name: 'Reorganize Pages', path: '/tools/pdf/reorganize' },
      { name: 'Unlock PDF', path: '/tools/pdf/unlock' },
    ],
    video: [
      { name: 'Split Video', path: '/tools/video/split' },
      { name: 'Trim Video', path: '/tools/video/trim' },
    ],
    audio: [
      // Compress Audio will go here later
    ],
    other: [
      { name: 'Images → PDF', path: '/tools/other/images-to-pdf' },
      { name: 'PDF → Images', path: '/tools/other/pdf-to-images' },
      { name: 'Convert to ZIP', path: '/tools/other/zip' },
    ],
  };

  return (
    <>
      <AppBar position="sticky" color="primary" elevation={1}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box
            component={Link}
            to="/"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              textDecoration: 'none',
              color: 'inherit',
            }}
            onClick={() => navigate('/')}
          >
            <Box
              component="img"
              src="/icon.png"
              alt="Logo"
              sx={{ height: '32px', width: '32px' }}
            />
            <Typography variant="h6">FileTools</Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            {Object.entries(menus).map(([key, list]) => (
              <Button
                key={key}
                color="inherit"
                endIcon={<ArrowDropDown />}
                onClick={e => handleMenuClick(e, key)}
              >
                {key === 'pdf' && 'PDF Tools'}
                {key === 'video' && 'Video Tools'}
                {key === 'audio' && 'Audio Tools'}
                {key === 'other' && 'Other Tools'}
              </Button>
            ))}

            <Tooltip
              title={
                mode === 'light'
                  ? 'Switch to Dark Mode'
                  : 'Switch to Light Mode'
              }
            >
              <IconButton color="inherit" onClick={toggleTheme}>
                {mode === 'light' ? <Brightness4 /> : <Brightness7 />}
              </IconButton>
            </Tooltip>
          </Stack>

          {/* Dropdown Menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            slotProps={{
              list: {
                sx: { minWidth: 210 },
              },
            }}
          >
            {menuType &&
              menus[menuType as keyof typeof menus].map(item => (
                <MenuItem
                  key={item.path}
                  onClick={() => {
                    handleMenuClose();
                    navigate(item.path);
                  }}
                >
                  {item.name}
                </MenuItem>
              ))}
          </Menu>
        </Toolbar>
      </AppBar>

      <Container sx={{ py: 4 }}>
        <Routes>
          <Route path="/">
            <Route index element={<HomeDashboard />} />
            <Route path="tools">
              {/* PDF Tools */}
              <Route path="pdf">
                <Route path="split" element={<SplitPdf />} />
                <Route path="unlock" element={<UnlockPdf />} />
                <Route path="merge" element={<MergePdf />} />
                <Route path="reorganize" element={<ReorganizePdf />} />
              </Route>
              {/* Video Tools */}
              <Route path="video">
                <Route path="split" element={<SplitVideo />} />
                <Route path="trim" element={<TrimVideo />} />
              </Route>
              {/* Other Tools */}
              <Route path="other">
                <Route path="images-to-pdf" element={<ImagesToPdf />} />
                <Route path="pdf-to-images" element={<PdfToImages />} />
                <Route path="zip" element={<ZipConvert />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Container>
    </>
  );
}
