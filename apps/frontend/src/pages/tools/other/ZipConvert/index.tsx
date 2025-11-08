// import { useState } from 'react';
// import axios from 'axios';
// import { Stack, Typography, Button, Alert, Paper } from '@mui/material';
// import FileDropZone from '../../../../components/FileDropZone';
// import DownloadButton from '../../../../components/DownloadButton';
// import { useUI } from '../../../../context/UIContext';

// interface ZipResult {
//   files: { name: string; url: string; size: number }[];
// }

// export default function ConvertToZip() {
//   const [files, setFiles] = useState<File[]>([]);
//   const [result, setResult] = useState<ZipResult | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const { setLoading, showMessage } = useUI();

//   async function handleConvert() {
//     if (!files.length) return setError('Please select files first');
//     setError(null);
//     setLoading(true);

//     try {
//       const form = new FormData();
//       files.forEach(f => form.append('files', f));

//       const res = await axios.post(
//         'http://localhost:4000/api/convert-to-zip',
//         form,
//         {
//           headers: { 'Content-Type': 'multipart/form-data' },
//         }
//       );

//       setResult(res.data);
//       showMessage(`Created ${res.data.files.length} ZIP files`, 'success');
//     } catch (err: any) {
//       setError(err.response?.data?.error || err.message);
//       showMessage('Conversion failed', 'error');
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <>
//       <Typography variant="h4" gutterBottom>
//         Convert Media to ZIP
//       </Typography>

//       <FileDropZone
//         onDrop={setFiles}
//         accept={{
//           'video/*': [],
//           'audio/*': [],
//           'application/pdf': [],
//           'image/*': [],
//         }}
//         label="Drop or select multiple files"
//       />

//       {files.length > 0 && (
//         <Paper
//           variant="outlined"
//           sx={{
//             mt: 2,
//             maxHeight: 200,
//             overflowY: 'auto',
//             p: 1,
//             bgcolor: 'background.paper',
//           }}
//         >
//           <Stack spacing={0.5}>
//             {files.map(f => (
//               <Typography key={f.name} variant="body2">
//                 {f.name} — {(f.size / 1024 / 1024).toFixed(2)} MB
//               </Typography>
//             ))}
//           </Stack>
//         </Paper>
//       )}

//       <Button
//         variant="contained"
//         color="primary"
//         sx={{ mt: 3 }}
//         disabled={!files.length}
//         onClick={handleConvert}
//       >
//         Convert to ZIP
//       </Button>

//       {error && (
//         <Alert severity="error" sx={{ mt: 2 }}>
//           {error}
//         </Alert>
//       )}

//       {result && (
//         <Stack sx={{ mt: 3 }} spacing={1}>
//           <Typography variant="h6">Download:</Typography>
//           {result.files.map(f => (
//             <DownloadButton
//               key={f.name}
//               href={`http://localhost:4000${f.url}`}
//               name={f.name}
//               sizeMB={f.size / 1024 / 1024}
//             />
//           ))}
//         </Stack>
//       )}
//     </>
//   );
// }

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
  Paper,
} from '@mui/material';
import { Archive } from '@mui/icons-material';

import { useUI } from '../../../../context/UIContext';
import FileDropZone from '../../../../components/FileDropZone';

interface ZipResult {
  files: { name: string; url: string; size: number }[];
}

export default function ConvertToZip() {
  const { loading, setLoading } = useUI();

  const [files, setFiles] = useState<File[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [resultFiles, setResultFiles] = useState<ZipResult['files']>([]);

  const handleFiles = (picked: File[]) => {
    setFiles(picked);
    setError(null);
    setResultFiles([]);
  };

  async function handleConvert() {
    if (!files.length) return setError('Please select files first.');
    setError(null);
    setResultFiles([]);
    setLoading(true);
    try {
      const form = new FormData();
      files.forEach(f => form.append('files', f));

      const res = await axios.post(
        'http://localhost:4000/api/convert-to-zip',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setResultFiles(res.data.files);
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
        <Archive fontSize="small" />
        <Typography variant="h5" fontWeight={700}>
          Convert to ZIP
        </Typography>
      </Stack>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={3}>
            <FileDropZone
              onDrop={handleFiles}
              accept={{
                'video/*': [],
                'audio/*': [],
                'application/pdf': [],
                'image/*': [],
              }}
              multiple
              label="Drop or select multiple files"
            />

            {files.length > 0 && (
              <Paper
                variant="outlined"
                sx={{ mt: 1, maxHeight: 200, overflowY: 'auto', p: 1 }}
              >
                <Stack spacing={0.5}>
                  {files.map(f => (
                    <Typography key={f.name} variant="body2">
                      {f.name} — {(f.size / 1024 / 1024).toFixed(2)} MB
                    </Typography>
                  ))}
                </Stack>
              </Paper>
            )}

            {error && <Alert severity="error">{error}</Alert>}
            {resultFiles.length > 0 && (
              <Alert severity="success">Zipped successfully!</Alert>
            )}
          </Stack>
        </CardContent>

        <CardActions sx={{ px: 3, pb: 3 }}>
          <Stack spacing={1.5}>
            <Button
              variant="contained"
              onClick={handleConvert}
              disabled={!files.length || loading}
            >
              Convert to ZIP
            </Button>

            {resultFiles.length > 0 && (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Output File(s)
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
                      </span>{' '}
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
