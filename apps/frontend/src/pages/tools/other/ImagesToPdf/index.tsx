import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  Stack,
  Typography,
  Button,
  Alert,
  TextField,
  Box,
  Card,
  CardContent,
  CardActions,
  Divider,
  Paper,
  Slider,
  IconButton,
} from '@mui/material';
import { Delete, Image } from '@mui/icons-material';

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useUI } from '../../../../context/UIContext';
import FileDropZone from '../../../../components/FileDropZone';

interface ApiSingleFile {
  name: string;
  url: string;
  size?: number;
}
interface ApiResponse {
  split?: boolean;
  file?: ApiSingleFile;
  files?: ApiSingleFile[];
}

function SortableThumb({
  id,
  src,
  index,
  onDelete,
}: {
  id: string;
  src: string;
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
      }}
    >
      <Box
        component="img"
        src={src}
        alt={`Page ${index + 1}`}
        sx={{
          display: 'block',
          width: '100%',
          height: 180,
          objectFit: 'cover',
          bgcolor: 'background.default',
        }}
        draggable={false}
      />

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

export default function ImagesToPdf() {
  const { loading, setLoading } = useUI();

  const [files, setFiles] = useState<{ id: string; file: File }[]>([]);
  const [thumbUrls, setThumbUrls] = useState<string[]>([]);
  const [customName, setCustomName] = useState('');
  const [maxChunkMB, setMaxChunkMB] = useState<number>(7);

  const [error, setError] = useState<string | null>(null);
  const [resultFiles, setResultFiles] = useState<ApiSingleFile[]>([]);

  // Derived list of IDs for dnd-kit. We’ll use the pageIndex as id string.
  const ids = useMemo(() => files.map(f => `p-${f.id}`), [files]);

  // Maintain object URLs for thumbnails (180px)
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f.file));
    setThumbUrls(urls);
    return () => {
      urls.forEach(u => URL.revokeObjectURL(u));
    };
  }, [files]);

  const onDropFiles = (picked: File[]) => {
    // append to current list
    setFiles(prev => [
      ...prev,
      ...picked.map(f => ({ id: crypto.randomUUID(), file: f })),
    ]);
    setResultFiles([]);
    setError(null);
  };

  // dnd handler
  const onDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIdx = ids.findIndex(id => id === active.id);
    const toIdx = ids.findIndex(id => id === over.id);
    if (fromIdx < 0 || toIdx < 0) return;

    const next = [...files];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setFiles(next);
  };

  const onDelete = (id: string) => {
    if (files.length > 1) {
      const pi = id.replace('p-', '');
      setFiles(prev => prev.filter(f => f.id !== pi));
    } else {
      setFiles([]);
      setResultFiles([]);
      setError(null);
    }
  };

  async function handleConvert() {
    if (!files.length) return setError('Please select images first.');
    setError(null);
    setLoading(true);
    setResultFiles([]);

    try {
      const form = new FormData();
      files.forEach(f => form.append('images', f.file)); // order preserved
      form.append(
        'maxChunkMB',
        String(Math.max(1, Math.min(500, Math.round(maxChunkMB))))
      );
      if (customName.trim()) form.append('filename', customName.trim());

      const { data } = await axios.post<ApiResponse>(
        'http://localhost:4000/api/image-to-pdf',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const filesOut: ApiSingleFile[] = data.split
        ? data.files || []
        : data.file
        ? [data.file]
        : [];
      setResultFiles(filesOut);
    } catch (err: any) {
      setError(
        err?.response?.data?.error || err.message || 'Conversion failed'
      );
    } finally {
      setLoading(false);
    }
  }

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 6 }, // must move 6px to start dragging
  });
  const sensors = useSensors(pointerSensor);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <Image fontSize="small" />
        <Typography variant="h5" fontWeight={700}>
          Images → PDF
        </Typography>
      </Stack>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={3}>
            <FileDropZone
              onDrop={onDropFiles}
              accept={{ 'image/*': [] }}
              label="Drop or select images"
              multiple
            />

            {files.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {files.length} image{files.length === 1 ? '' : 's'} selected
              </Typography>
            )}

            {/* Optional filename */}
            <TextField
              label="Output File Name (optional)"
              size="small"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              sx={{ width: 360 }}
            />

            {/* Max chunk slider */}
            <Stack>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ minWidth: 160 }}
                >
                  Auto-split max size (MB)
                </Typography>
                <Slider
                  value={maxChunkMB}
                  min={1}
                  max={100}
                  step={1}
                  onChange={(_, val) => setMaxChunkMB(val as number)}
                  sx={{ flex: 1 }}
                />
                <Typography
                  variant="body2"
                  sx={{ width: 60, textAlign: 'right' }}
                >
                  {maxChunkMB} MB
                </Typography>
              </Stack>
            </Stack>

            {/* Reorder grid (180px thumbnails) */}
            {files.length > 0 && (
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Drag to reorder pages
                </Typography>

                <DndContext
                  sensors={sensors}
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
                      {files.map((f, pageIndex) => {
                        const thumb = thumbUrls[pageIndex];
                        return (
                          <SortableThumb
                            key={`p-${f.id}`}
                            id={`p-${f.id}`}
                            src={thumb}
                            index={pageIndex}
                            onDelete={onDelete}
                          />
                        );
                      })}
                    </Box>
                  </SortableContext>
                </DndContext>
              </Stack>
            )}

            {error && <Alert severity="error">{error}</Alert>}
            {resultFiles.length > 0 && (
              <Alert severity="success">
                Conversion complete. Download your files below.
              </Alert>
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
              Convert to PDF
            </Button>

            {/* Results list */}
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
