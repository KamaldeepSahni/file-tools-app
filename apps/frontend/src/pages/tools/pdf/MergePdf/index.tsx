import { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Stack,
  Typography,
  TextField,
  IconButton,
  Button,
  Backdrop,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import { JoinFull, Delete } from '@mui/icons-material';
import axios from 'axios';

import { DndContext, closestCenter } from '@dnd-kit/core';
import {
  useSortable,
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useUI } from '../../../../context/UIContext';
import FileDropZone from '../../../../components/FileDropZone';

function SortableThumb({
  id,
  name,
  index,
  onDelete,
}: {
  id: string;
  name: string;
  index: number;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: 'grab',
  } as React.CSSProperties;

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: isDragging ? 'primary.main' : 'divider',
        boxShadow: isDragging ? 3 : 0,
        position: 'relative',
        p: 1,
      }}
    >
      <Box
        component="img"
        src={'/pdf-icon.png'}
        alt={`Page ${index + 1}`}
        sx={{
          display: 'block',
          width: '100%',
          height: 180,
          objectFit: 'cover',
        }}
        draggable={false}
      />

      <Tooltip title={name}>
        <Typography variant="body2" noWrap>
          {name}
        </Typography>
      </Tooltip>

      {/* page index badge */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          px: 1,
          py: 0.25,
          fontSize: 12,
          bgcolor: 'rgba(0,0,0,0.5)',
          color: '#fff',
          borderRadius: 1,
        }}
      >
        {index + 1}
      </Box>

      {/* delete button */}
      <IconButton
        size="small"
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          bgcolor: 'rgba(0,0,0,0.5)',
          ':hover': { bgcolor: 'rgba(0,0,0,0.7)' },
        }}
        onMouseDown={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation();
          onDelete(id);
        }}
      >
        <Delete sx={{ fontSize: 12 }} />
      </IconButton>
    </Box>
  );
}

type APIResponse = {
  file: { name: string; url: string; size: number };
};

export default function MergePdf() {
  const { loading, setLoading } = useUI();

  const [files, setFiles] = useState<File[]>([]);
  const [outputName, setOutputName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<APIResponse['file'] | null>(null);

  // Derived list of IDs for dnd-kit
  const ids = useMemo(() => files.map(f => f.name), [files]);

  const handleFiles = (picked: File[]) => {
    setFiles(prev => [...prev, ...picked].slice(0, 50));
    setError(null);
    setResult(null);
  };

  const onDelete = (id: string) => {
    if (files.length > 2) {
      setFiles(prev => prev.filter(f => f.name !== id));
    } else {
      setFiles([]);
      setError(null);
      setResult(null);
    }
  };

  const onDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = files.findIndex(f => f.name === active.id);
    const newIndex = files.findIndex(f => f.name === over.id);
    const newArr = [...files];
    const [moved] = newArr.splice(oldIndex, 1);
    newArr.splice(newIndex, 0, moved);
    setFiles(newArr);
  };

  const mergeHandler = async () => {
    setError(null);
    setResult(null);
    if (files.length < 2) {
      setError('Need at least 2 PDFs');
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      files.forEach(f => form.append('pdfs', f));
      if (outputName.trim()) form.append('filename', outputName.trim());

      const { data } = await axios.post(
        'http://localhost:4000/api/pdf/merge',
        form,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      setResult(data.file);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed merging PDFs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <JoinFull fontSize="small" />
        <Typography variant="h5" fontWeight={700}>
          Merge PDFs
        </Typography>
      </Stack>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={3}>
            <FileDropZone
              multiple={true}
              accept={{ 'application/pdf': ['.pdf'] }}
              onDrop={handleFiles}
              label="Drop or select PDF files"
            />

            <TextField
              label="Output filename (optional)"
              value={outputName}
              onChange={e => setOutputName(e.target.value)}
              fullWidth
            />

            {files.length > 0 && (
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Drag to reorder pages
                </Typography>

                <DndContext
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext items={ids} strategy={rectSortingStrategy}>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(auto-fill, minmax(160px, 1fr))',
                        gap: 2,
                      }}
                    >
                      {files.map((f, index) => (
                        <SortableThumb
                          key={f.name}
                          id={f.name}
                          name={f.name}
                          index={index}
                          onDelete={onDelete}
                        />
                      ))}
                    </Box>
                  </SortableContext>
                </DndContext>
              </Stack>
            )}

            {error && <Alert severity="error">{error}</Alert>}
            {result && <Alert severity="success">Merged successfully!</Alert>}
          </Stack>
        </CardContent>

        <CardActions sx={{ px: 3, pb: 3 }}>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              onClick={mergeHandler}
              disabled={loading || files.length < 2}
            >
              Merge PDFs
            </Button>
            {result && (
              <Button
                variant="outlined"
                href={`http://localhost:4000${result.url}`}
              >
                Download Merged PDF
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
