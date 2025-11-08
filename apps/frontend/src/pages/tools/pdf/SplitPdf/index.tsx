import { useState } from 'react';
import axios from 'axios';
import {
  Stack,
  Typography,
  Button,
  Alert,
  Slider,
  Box,
  Card,
  CardContent,
  CardActions,
  Divider,
} from '@mui/material';
import { ContentCut } from '@mui/icons-material';

import { useUI } from '../../../../context/UIContext';
import FileDropZone from '../../../../components/FileDropZone';

export default function PdfSplitter() {
  const { loading, setLoading } = useUI();

  const [file, setFile] = useState<File | null>(null);
  const [chunkSize, setChunkSize] = useState<number>(7);

  const [error, setError] = useState<string | null>(null);
  const [resultFiles, setResultFiles] = useState<
    { name: string; url: string }[]
  >([]);

  async function handleSplit() {
    if (!file) return setError('Please select a PDF file first.');
    setError(null);
    setLoading(true);

    try {
      const form = new FormData();
      form.append('pdf', file);
      form.append('chunkSizeMB', chunkSize.toString());
      const res = await axios.post(
        'http://localhost:4000/api/split-pdf',
        form,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      setResultFiles(res.data.files);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Splitting failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <ContentCut fontSize="small" />
        <Typography variant="h5" fontWeight={700}>
          Split PDF
        </Typography>
      </Stack>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={3}>
            <FileDropZone
              onDrop={files => setFile(files[0])}
              accept={{ 'application/pdf': [] }}
              label="Drop or select a PDF file"
            />

            {file && (
              <Typography sx={{ mt: 2 }}>
                {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
              </Typography>
            )}

            {file && (
              <>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ minWidth: 120 }}
                  >
                    Chunk size (MB)
                  </Typography>
                  <Slider
                    value={chunkSize}
                    onChange={(_, v) => setChunkSize(v as number)}
                    step={1}
                    min={1}
                    max={500}
                    sx={{ flex: 1 }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ width: 60, textAlign: 'right' }}
                  >
                    {chunkSize} MB
                  </Typography>
                </Stack>
              </>
            )}

            {error && <Alert severity="error">{error}</Alert>}
            {resultFiles.length > 0 && (
              <Alert severity="success">
                Split complete. Download your chunks below.
              </Alert>
            )}
          </Stack>
        </CardContent>
        <CardActions sx={{ px: 3, pb: 3 }}>
          <Stack spacing={1.5}>
            <Button
              variant="contained"
              onClick={handleSplit}
              disabled={!file || loading}
            >
              Split PDF
            </Button>

            {/* Results list */}
            {resultFiles.length > 0 && (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Output Chunks
                </Typography>
                <Divider />
                <Stack spacing={1}>
                  {resultFiles.map(f => (
                    <Button
                      key={f.url}
                      variant="outlined"
                      href={`http://localhost:4000${f.url}`}
                      sx={{ justifyContent: 'space-between' }}
                    >
                      <span
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {f.name}
                      </span>
                      &nbsp;
                      <span>Download</span>
                    </Button>
                  ))}
                </Stack>
              </Stack>
            )}
          </Stack>
        </CardActions>
      </Card>
    </Box>
  );
}
