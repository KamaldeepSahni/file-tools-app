import { useState } from 'react';
import axios from 'axios';
import {
  Stack,
  Typography,
  Button,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import FileDropZone from '../components/FileDropZone';
import DownloadButton from '../components/DownloadButton';
import { useUI } from '../context/UIContext';

interface CompressedResult {
  file: { name: string; url: string; size: number };
}

export default function Compressor() {
  const [type, setType] = useState<'pdf' | 'media'>('pdf');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CompressedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { setLoading, showMessage } = useUI();

  const handleTypeChange = (_: any, newType: 'pdf' | 'media' | null) => {
    if (newType) {
      setType(newType);
      setFile(null);
      setResult(null);
      setError(null);
    }
  };

  async function handleCompress() {
    if (!file) return setError('Please select a file first.');
    setError(null);
    setLoading(true);

    try {
      const form = new FormData();
      const fieldName = type === 'pdf' ? 'pdf' : 'media';
      form.append(fieldName, file);
      const url =
        type === 'pdf'
          ? 'http://localhost:4000/api/compress/pdf'
          : 'http://localhost:4000/api/compress/media';

      const res = await axios.post(url, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setResult(res.data);
      showMessage(`${type.toUpperCase()} compression complete!`, 'success');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
      showMessage(`Failed to compress ${type}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Compressor
      </Typography>

      <ToggleButtonGroup
        value={type}
        exclusive
        onChange={handleTypeChange}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="pdf">PDF</ToggleButton>
        <ToggleButton value="media">Video / Audio</ToggleButton>
      </ToggleButtonGroup>

      <FileDropZone
        onDrop={files => setFile(files[0])}
        accept={
          type === 'pdf'
            ? { 'application/pdf': [] }
            : { 'video/*': [], 'audio/*': [] }
        }
        label={
          type === 'pdf'
            ? 'Drop or select a PDF to compress'
            : 'Drop or select a video/audio file to compress'
        }
      />

      {file && (
        <Typography sx={{ mt: 2 }}>
          {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
        </Typography>
      )}

      <Button
        variant="contained"
        color="primary"
        sx={{ mt: 3 }}
        disabled={!file}
        onClick={handleCompress}
      >
        Compress {type.toUpperCase()}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Stack sx={{ mt: 3 }} spacing={1}>
          <Typography variant="h6">Download:</Typography>
          <DownloadButton
            href={`http://localhost:4000${result.file.url}`}
            name={result.file.name}
            sizeMB={result.file.size / 1024 / 1024}
          />
        </Stack>
      )}
    </>
  );
}
