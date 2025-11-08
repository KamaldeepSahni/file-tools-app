import { useState } from 'react';
import axios from 'axios';
import {
  Stack,
  Typography,
  Button,
  Alert,
  Box,
  Card,
  CardContent,
  CardActions,
  Divider,
  Slider,
  Paper,
} from '@mui/material';
import { AudioFile } from '@mui/icons-material';
import FileDropZone from '../../../../components/FileDropZone';
import { useUI } from '../../../../context/UIContext';

export default function CompressAudio() {
  const { loading, setLoading, showMessage } = useUI();

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultFile, setResultFile] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const [target, setTarget] = useState<number>(7);

  async function handleCompress() {
    if (!file) return setError('Please select an audio file first.');
    setError(null);
    setResultFile(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append('media', file);
      form.append('maxSizeMB', target.toString());

      const res = await axios.post(
        'http://localhost:4000/api/compress/media',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setResultFile(res.data.file);
      showMessage('Audio compressed successfully!', 'success');
    } catch (err: any) {
      setError(
        err?.response?.data?.error || err.message || 'Compression failed'
      );
      showMessage('Compression failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <AudioFile fontSize="small" />
        <Typography variant="h5" fontWeight={700}>
          Compress Audio
        </Typography>
      </Stack>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={3}>
            <FileDropZone
              onDrop={picked => setFile(picked[0])}
              accept={{ 'audio/*': [] }}
              label="Drop or select an audio file"
              multiple={false}
            />

            {file && (
              <Typography variant="body2" color="text.secondary">
                {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
              </Typography>
            )}

            {file && (
              <Stack direction="row" alignItems="center" spacing={2}>
                <Typography
                  variant="body2"
                  sx={{ minWidth: 120 }}
                  color="text.secondary"
                >
                  Target Size
                </Typography>
                <Slider
                  value={target}
                  onChange={(_, v) => setTarget(v as number)}
                  step={1}
                  min={1}
                  max={500}
                  sx={{ flex: 1 }}
                />
                <Typography
                  variant="body2"
                  sx={{ width: 60, textAlign: 'right' }}
                >
                  {target} MB
                </Typography>
              </Stack>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </CardContent>

        <CardActions sx={{ px: 3, pb: 3 }}>
          <Stack spacing={1.5} sx={{ width: '100%' }}>
            <Button
              variant="contained"
              onClick={handleCompress}
              disabled={!file || loading}
            >
              Compress Audio
            </Button>

            {resultFile && (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Output
                </Typography>
                <Divider />
                <Stack spacing={1}>
                  <Button
                    variant="outlined"
                    href={`http://localhost:4000${resultFile.url}`}
                    sx={{ justifyContent: 'space-between' }}
                  >
                    <span
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {resultFile.name}
                    </span>
                    <span>Download</span>
                  </Button>
                </Stack>
              </Stack>
            )}
          </Stack>
        </CardActions>
      </Card>
    </Box>
  );
}

