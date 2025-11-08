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
} from '@mui/material';
import { PictureAsPdf } from '@mui/icons-material';

import { useUI } from '../../../../context/UIContext';
import FileDropZone from '../../../../components/FileDropZone';

interface PdfToImagesResult {
  zip: { name: string; url: string; size: number };
  count: number;
}

export default function PdfToImages() {
  const { loading, setLoading } = useUI();

  const [file, setFile] = useState<File | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PdfToImagesResult | null>(null);

  const handleFiles = (picked: File[]) => {
    setFile(picked[0]);
    setError(null);
    setResult(null);
  };

  async function handleConvert() {
    if (!file) return setError('Please select a PDF first.');
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append('pdf', file);

      const res = await axios.post(
        'http://localhost:4000/api/pdf-to-images',
        form,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      setResult(res.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.error || err.message || 'Conversion failed'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <PictureAsPdf fontSize="small" />
        <Typography variant="h5" fontWeight={700}>
          PDF → Images
        </Typography>
      </Stack>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={3}>
            <FileDropZone
              onDrop={handleFiles}
              accept={{ 'application/pdf': [] }}
              label="Drop or select a PDF file"
            />

            {file && (
              <Typography variant="body2" color="text.secondary">
                {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
              </Typography>
            )}

            {error && <Alert severity="error">{error}</Alert>}
            {result && (
              <Alert severity="success">Extracted successfully!</Alert>
            )}
          </Stack>
        </CardContent>

        <CardActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="contained"
            onClick={handleConvert}
            disabled={!file || loading}
          >
            Convert to Images (ZIP)
          </Button>
          {result && (
            <Button
              variant="outlined"
              href={`http://localhost:4000${result.zip.url}`}
            >
              Download Zipped Images
            </Button>
          )}
        </CardActions>
      </Card>
    </Box>
  );
}
