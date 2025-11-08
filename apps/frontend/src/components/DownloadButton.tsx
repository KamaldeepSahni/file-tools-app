import { Button } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';

interface Props {
  href: string;
  name: string;
  sizeMB?: number;
}

export default function DownloadButton({ href, name, sizeMB }: Props) {
  return (
    <Button
      variant="outlined"
      color="primary"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      startIcon={<DownloadIcon />}
      sx={{ justifyContent: 'flex-start' }}
    >
      {name} {sizeMB ? `(${sizeMB.toFixed(2)} MB)` : ''}
    </Button>
  );
}
