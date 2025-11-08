import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Stack,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Backdrop,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { Visibility, VisibilityOff, LockOpen } from '@mui/icons-material';
import axios from 'axios';

import { useUI } from '../../../../context/UIContext';
import FileDropZone from '../../../../components/FileDropZone';

type ApiResponse = {
  file: { name: string; url: string; size: number };
};

export default function UnlockPdf() {
  const { loading, setLoading } = useUI();

  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [result, setResult] = useState<ApiResponse['file'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFilesSelected = (picked: File[]) => {
    setFile(picked?.[0] || null);
    setResult(null);
    setError(null);
  };

  const handleUnlock = async () => {
    setError(null);
    setResult(null);

    if (!file) {
      setError('Please upload a password-protected PDF.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter the password.');
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('pdf', file);
      form.append('password', password);

      const { data } = await axios.post<ApiResponse>(
        'http://localhost:4000/api/pdf/remove-password',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setResult(data.file);
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        'Failed to unlock PDF. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <LockOpen fontSize="small" />
        <Typography variant="h5" fontWeight={700}>
          Unlock PDF
        </Typography>
      </Stack>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={3}>
            <FileDropZone
              multiple={false}
              onDrop={onFilesSelected}
              accept={{ 'application/pdf': ['.pdf'] }}
              label="Drop or select a PDF file"
            />

            {file && (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={file.name} variant="outlined" />
              </Stack>
            )}

            <TextField
              label="Password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPw(s => !s)}
                      edge="end"
                    >
                      {showPw ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {error && <Alert severity="error">{error}</Alert>}
            {result && (
              <Alert severity="success">
                Unlocked! Click “Download Unlocked PDF”.
              </Alert>
            )}
          </Stack>
        </CardContent>

        <CardActions sx={{ px: 3, pb: 3 }}>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              onClick={handleUnlock}
              disabled={loading || !file || !password.trim()}
            >
              Unlock PDF
            </Button>

            {result && (
              <Button
                variant="outlined"
                href={`http://localhost:4000${result.url}`}
              >
                Download Unlocked PDF
              </Button>
            )}
          </Stack>
        </CardActions>
      </Card>

      <Backdrop
        open={loading}
        sx={{ color: '#fff', zIndex: t => t.zIndex.drawer + 1 }}
      >
        <CircularProgress />
      </Backdrop>
    </Box>
  );
}
