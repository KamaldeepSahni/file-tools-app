import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Stack,
  Typography,
  Button,
  TextField,
  Alert,
  Backdrop,
  CircularProgress,
  Collapse,
  Divider,
  Slider,
} from '@mui/material';
import { ContentCut, Timer, PlayArrow } from '@mui/icons-material';
import axios from 'axios';

import { useUI } from '../../../../context/UIContext';
import FileDropZone from '../../../../components/FileDropZone';

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function TrimVideo() {
  const { loading, setLoading } = useUI();

  const [file, setFile] = useState<File | null>(null);

  const [requestId, setRequestId] = useState('');
  const [requestFilename, setRequestFilename] = useState('');
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState<number[]>([0, 0]);
  const [filename, setFilename] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; url: string } | null>(
    null
  );

  // Local preview URL for original video
  const videoURL = useMemo(
    () => (file ? URL.createObjectURL(file) : ''),
    [file]
  );
  const videoRef = useRef<HTMLVideoElement>(null);

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (videoURL) URL.revokeObjectURL(videoURL);
    };
  }, [videoURL]);

  // Throttled seeking to START time while dragging
  const seekTimeout = useRef<number | undefined>(undefined);
  const throttledSeekTo = (t: number) => {
    if (!videoRef.current) return;
    if (seekTimeout.current) {
      window.clearTimeout(seekTimeout.current);
    }
    seekTimeout.current = window.setTimeout(() => {
      if (videoRef.current) {
        try {
          videoRef.current.currentTime = Math.max(0, Math.min(t, duration));
        } catch {
          /* ignore seek errors */
        }
      }
    }, 150);
  };

  const onFilesSelected = (picked: File[]) => {
    setFile(picked?.[0] || null);
    setRequestId('');
    setRequestFilename('');
    setDuration(0);
    setRange([0, 0]);
    setError(null);
    setResult(null);
    setPreviewOpen(false);
    init(picked?.[0] || null);
  };

  const init = async (file: File) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append('video', file);
      const { data } = await axios.post(
        'http://localhost:4000/api/video/trim/init',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      console.log(data);

      setRequestId(data.requestId);
      setRequestFilename(data.filename);
      setDuration(Math.floor(data.duration || 0));
      setRange([0, Math.floor(data.duration || 0)]);
      setPreviewOpen(true); // C1: auto-expand preview after init
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load video metadata');
    } finally {
      setLoading(false);
    }
  };

  const build = async () => {
    if (!requestId) {
      setError('Load duration first.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        requestId,
        start: range[0],
        end: range[1],
        filename: filename
          ? `${filename.trim()}.mp4`
          : requestFilename?.trim() || undefined,
      };
      const { data } = await axios.post(
        'http://localhost:4000/api/video/trim/build',
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      );
      setResult(data.file);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to trim video');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <ContentCut fontSize="small" />
        <Typography variant="h5" fontWeight={700}>
          Trim Video
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
              </Typography>
            )}

            {/* PREVIEW (collapsible) */}
            {!!videoURL && (
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ cursor: 'pointer' }}
                onClick={() => setPreviewOpen(o => !o)}
              >
                <PlayArrow
                  fontSize="small"
                  sx={[
                    { transition: 'transform 0.2s' },
                    previewOpen ? { transform: 'rotate(90deg)' } : {},
                  ]}
                />
                <Typography variant="subtitle1" fontWeight={600}>
                  Preview
                </Typography>
              </Stack>
            )}
            <Collapse in={previewOpen && !!videoURL} unmountOnExit>
              <Stack spacing={1.5}>
                <Box
                  sx={{
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {videoURL && (
                    <video
                      src={videoURL}
                      ref={videoRef}
                      controls
                      style={{
                        width: '100%',
                        display: 'block',
                        maxHeight: 400,
                      }}
                      onTimeUpdate={e => {
                        const current = (e.target as HTMLVideoElement)
                          .currentTime;

                        if (current > range[1]) {
                          // If user seeks outside selected range, pause
                          if (videoRef.current) {
                            videoRef.current.pause();
                          }
                        }
                      }}
                      onSeeked={e => {
                        const current = (e.target as HTMLVideoElement)
                          .currentTime;

                        if (current < range[0] || current > range[1]) {
                          // If user seeks outside selected range, jump back to start
                          if (videoRef.current) {
                            videoRef.current.currentTime = range[0];
                          }
                        }
                      }}
                    />
                  )}
                </Box>
              </Stack>
              <Divider sx={{ my: 2 }} />
            </Collapse>

            {/* Time + Slider */}
            {requestId && (
              <>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Timer fontSize="small" />
                  <Typography variant="body2">
                    Start: <b>{formatTime(range[0])}</b>
                  </Typography>
                  <Typography variant="body2">
                    End: <b>{formatTime(range[1])}</b>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Duration: <b>{formatTime(range[1] - range[0])}</b>
                  </Typography>
                </Stack>

                <Slider
                  value={range}
                  min={0}
                  max={duration}
                  step={0.1}
                  onChange={(_, val) => {
                    const [start, end] = val as number[];
                    // keep in bounds and monotonic
                    const s = Math.max(0, Math.min(start, end - 0.1));
                    const e = Math.max(s + 0.1, Math.min(end, duration));
                    setRange([s, e]);
                    // Always preview START position (your choice A), throttled
                    throttledSeekTo(s);
                  }}
                  sx={{ mt: -1 }}
                />

                <TextField
                  label="Output filename (optional, .mp4 output)"
                  fullWidth
                  value={filename}
                  onChange={e => setFilename(e.target.value)}
                />
              </>
            )}

            {error && <Alert severity="error">{error}</Alert>}
            {result && (
              <Alert severity="success">
                Trim complete. Click “Download Trimmed Video”.
              </Alert>
            )}
          </Stack>
        </CardContent>

        <CardActions sx={{ px: 3, pb: 3 }}>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              onClick={build}
              disabled={!requestId || loading || range[1] - range[0] <= 0}
            >
              Trim Video
            </Button>

            {result && (
              <Button
                variant="outlined"
                href={`http://localhost:4000${result.url}`}
              >
                Download Trimmed Video
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
