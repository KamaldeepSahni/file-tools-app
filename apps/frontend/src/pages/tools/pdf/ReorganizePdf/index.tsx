import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Stack,
  Typography,
  Button,
  Backdrop,
  CircularProgress,
  Alert,
  TextField,
  IconButton,
} from '@mui/material';
import { DashboardCustomize, Delete } from '@mui/icons-material';
import axios from 'axios';

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

type InitPage = { pageIndex: number; thumbnail: string };
type InitResponse = {
  requestId: string;
  totalPages: number;
  pages: InitPage[];
  filename: string;
};

type BuildResponse = {
  file: { name: string; url: string; size: number };
};

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
        src={`http://localhost:4000${src}`}
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

export default function ReorganizePdf() {
  const { loading: building, setLoading: setBuilding } = useUI();

  const [loading, setLoading] = useState(false);
  const [initData, setInitData] = useState<InitResponse | null>(null);
  const [order, setOrder] = useState<number[]>([]); // array of pageIndex in current UI order
  const [outName, setOutName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BuildResponse['file'] | null>(null);

  // Derived list of IDs for dnd-kit. We’ll use the pageIndex as id string.
  const ids = useMemo(() => order.map(pi => `p-${pi}`), [order]);

  const onFilesSelected = (picked: File[]) => {
    setInitData(null);
    setOrder([]);
    setError(null);
    setResult(null);
    handleInit(picked?.[0]);
  };

  const handleInit = async (file: File) => {
    if (!file) {
      setError('Please upload a PDF first.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append('pdf', file);
      const { data } = await axios.post<InitResponse>(
        'http://localhost:4000/api/pdf/reorganize/init',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setInitData(data);
      setOrder(data.pages.map(p => p.pageIndex)); // initial visual order = natural order
    } catch (e: any) {
      setError(
        e?.response?.data?.error ||
          e?.message ||
          'Failed to initialize reorganization.'
      );
    } finally {
      setLoading(false);
    }
  };

  // dnd handler
  const onDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIdx = ids.findIndex(id => id === active.id);
    const toIdx = ids.findIndex(id => id === over.id);
    if (fromIdx < 0 || toIdx < 0) return;

    const next = [...order];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setOrder(next);
  };

  const onDelete = (id: string) => {
    if (order.length > 1) {
      const pi = parseInt(id.replace('p-', ''));
      setOrder(prev => prev.filter(i => i !== pi));
    } else {
      setInitData(null);
      setOrder([]);
      setError(null);
      setResult(null);
    }
  };

  const handleBuild = async () => {
    if (!initData) return;
    setBuilding(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        requestId: initData.requestId,
        order, // array of pageIndex in new order
        filename: outName.trim() || initData.filename || undefined,
      };
      const { data } = await axios.post<BuildResponse>(
        'http://localhost:4000/api/pdf/reorganize/build',
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      );
      setResult(data.file);
    } catch (e: any) {
      setError(
        e?.response?.data?.error ||
          e?.message ||
          'Failed to build reordered PDF.'
      );
    } finally {
      setBuilding(false);
    }
  };

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 6 }, // must move 6px to start dragging
  });
  const sensors = useSensors(pointerSensor);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <DashboardCustomize fontSize="small" />
        <Typography variant="h5" fontWeight={700}>
          Reorganize PDF Pages
        </Typography>
      </Stack>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={3}>
            <FileDropZone
              multiple={false}
              accept={{ 'application/pdf': ['.pdf'] }}
              onDrop={onFilesSelected}
              label="Drop or select a PDF file"
            />

            {initData && (
              <TextField
                label="Output filename (optional)"
                fullWidth
                value={outName}
                onChange={e => setOutName(e.target.value)}
              />
            )}

            {initData && (
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
                      {order.map((pageIndex, visualIndex) => {
                        const thumb = initData.pages[pageIndex]?.thumbnail;
                        return (
                          <SortableThumb
                            key={`p-${pageIndex}`}
                            id={`p-${pageIndex}`}
                            src={thumb}
                            index={visualIndex}
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
            {result && (
              <Alert severity="success">
                Rebuilt successfully. Click download.
              </Alert>
            )}
          </Stack>
        </CardContent>

        <CardActions sx={{ px: 3, pb: 3 }}>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              onClick={handleBuild}
              disabled={!initData || building}
            >
              Rebuild PDF
            </Button>

            {result && (
              <Button
                variant="outlined"
                href={`http://localhost:4000${result.url}`}
              >
                Download
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
