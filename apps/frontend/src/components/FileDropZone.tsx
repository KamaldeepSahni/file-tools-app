import { useDropzone } from 'react-dropzone';
import { Paper, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface Props {
  onDrop: (files: File[]) => void;
  accept?: Record<string, string[]>;
  multiple?: boolean;
  label: string;
}

export default function FileDropZone({
  onDrop,
  accept,
  multiple,
  label,
}: Props) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple,
  });

  return (
    <Paper
      variant="outlined"
      {...getRootProps()}
      sx={{
        p: 4,
        textAlign: 'center',
        borderStyle: 'dashed',
        borderColor: isDragActive ? 'primary.main' : 'grey.400',
        bgcolor: isDragActive ? 'grey.100' : 'background.paper',
        cursor: 'pointer',
        transition: '0.2s',
      }}
    >
      <input {...getInputProps()} />
      <CloudUploadIcon color="disabled" sx={{ fontSize: 50, mb: 1 }} />
      <Typography>{label}</Typography>
    </Paper>
  );
}
