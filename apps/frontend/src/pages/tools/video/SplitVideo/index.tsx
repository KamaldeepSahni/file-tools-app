import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Stack,
  Typography,
  Button,
  Alert,
  Divider,
  Switch,
  FormControlLabel,
  Slider,
} from '@mui/material';
import { PermMedia, ScatterPlot } from '@mui/icons-material';
import axios from 'axios';

import { useUI } from '../../../../context/UIContext';
import FileDropZone from '../../../../components/FileDropZone';

function ceilDiv(a: number, b: number) {
  if (!a || !b) return 0;
  return Math.ceil(a / b);
}

export default function SplitVideo() {
  const { loading, setLoading } = useUI();

  const [file, setFile] = useState<File | null>(null);

  const [chunkSizeMB, setChunkSizeMB] = useState<number>(7); // 1..500 integer
  const [zipChunks, setZipChunks] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [resultFiles, setResultFiles] = useState<
    Array<{ name: string; url: string }>
  >([]);

  const fileSizeMB = useMemo(
    () => (file ? file.size / (1024 * 1024) : 0),
    [file]
  );
  const estimatedChunks = useMemo(() => {
    const size = Math.max(0, fileSizeMB);
    const denom = Math.max(1, Math.min(500, Math.round(chunkSizeMB)));
    return size > 0 ? ceilDiv(size, denom) : 0; // **B: CEIL**
  }, [fileSizeMB, chunkSizeMB]);

  const onFilesSelected = (picked: File[]) => {
    setFile(picked?.[0] || null);
    setError(null);
    setResultFiles([]);
    setChunkSizeMB(7);
    setZipChunks(false);
  };

  // no INIT required for split

  const build = async () => {
    if (!file) {
      setError('Select a video first.');
      return;
    }
    setLoading(true);
    setError(null);
    setResultFiles([]);
    try {
      const form = new FormData();
      form.append('video', file);
      form.append(
        'chunkSizeMB',
        String(Math.max(1, Math.min(500, Math.round(chunkSizeMB))))
      );
      form.append('asZip', String(zipChunks));

      const { data } = await axios.post(
        'http://localhost:4000/api/split-video',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const files = data.files || [];
      setResultFiles(files);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to split video');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <PermMedia fontSize="small" />
        <Typography variant="h5" fontWeight={700}>
          Split Video
        </Typography>
      </Stack>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={3}>
            {/* Dropzone */}
            <FileDropZone
              multiple={false}
              accept={{
                'video/mp4': ['.mp4'],
                'video/quicktime': ['.mov'],
                'video/x-matroska': ['.mkv'],
                'video/webm': ['.webm'],
              }}
              onDrop={onFilesSelected}
              label="Drop or select a video file"
            />

            {file && (
              <Typography variant="body2" color="text.secondary">
                Selected: <strong>{file.name}</strong>
                {fileSizeMB ? ` · ${fileSizeMB.toFixed(2)} MB` : null}
              </Typography>
            )}

            {/* Controls (no preview for split) */}
            {file && (
              <>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <ScatterPlot fontSize="small" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Split Settings
                  </Typography>
                </Stack>

                {/* Chunk Size Slider */}
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ minWidth: 120 }}
                    >
                      Chunk size (MB)
                    </Typography>
                    <Slider
                      value={chunkSizeMB}
                      min={1}
                      max={100}
                      step={1}
                      onChange={(_, val) => setChunkSizeMB(val as number)}
                      sx={{ flex: 1 }}
                    />
                    <Typography
                      variant="body2"
                      sx={{ width: 72, textAlign: 'right' }}
                    >
                      {chunkSizeMB} MB
                    </Typography>
                  </Stack>
                  {file && (
                    <Typography variant="caption" color="text.secondary">
                      Estimated chunks: <b>{estimatedChunks}</b>
                    </Typography>
                  )}
                </Stack>

                {/* Zip toggle */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={zipChunks}
                      onChange={e => setZipChunks(e.target.checked)}
                    />
                  }
                  label="Zip each chunk (individual .zip per chunk)"
                />
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
              onClick={build}
              disabled={!file || loading}
            >
              Split Video
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

