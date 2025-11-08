import { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  CardActionArea,
  Stack,
  Box,
  Chip,
  Avatar,
  Divider,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PictureAsPdf,
  Image,
  ContentCut,
  VideoFile,
  Archive,
  Compress,
  Description,
  Movie,
  Settings,
  History,
  GraphicEq,
  LockOpen,
  JoinFull,
  DashboardCustomize,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const tools = [
  {
    category: 'PDF Tools',
    color: 'linear-gradient(90deg, #E53935, #EF9A9A)',
    icon: <Description />,
    items: [
      {
        name: 'Split PDF',
        path: '/tools/pdf/split',
        icon: <ContentCut />,
        desc: 'Split PDF into 7MB chunks',
      },
      // we will add these 3 AFTER their pages exist (coming next phases)
      {
        name: 'Merge PDFs',
        path: '/tools/pdf/merge',
        icon: <JoinFull />,
        desc: 'Combine multiple PDFs into one file',
      },
      {
        name: 'Reorganize Pages',
        path: '/tools/pdf/reorganize',
        icon: <DashboardCustomize />,
        desc: 'Reorder/remove pages inside PDF',
      },
      {
        name: 'Unlock PDF',
        path: '/tools/pdf/unlock',
        icon: <LockOpen />,
        desc: 'Remove PDF password protection',
      },
    ],
  },
  {
    category: 'Video Tools',
    color: 'linear-gradient(90deg, #8E24AA, #CE93D8)',
    icon: <Movie />,
    items: [
      {
        name: 'Split Video',
        path: '/tools/video/split',
        icon: <VideoFile />,
        desc: 'Split videos into smaller chunks',
      },
      {
        name: 'Trim Video',
        path: '/tools/video/trim',
        icon: <ContentCut />,
        desc: 'Cut a portion of the video',
      },
    ],
  },
  {
    category: 'Audio Tools',
    color: 'linear-gradient(90deg, #43a047, #a5d6a7)',
    icon: <GraphicEq />,
    items: [
      // compress audio will be inserted later
    ],
  },
  {
    category: 'Other Tools',
    color: 'linear-gradient(90deg, #0288D1, #81D4FA)',
    icon: <Settings />,
    items: [
      {
        name: 'Images → PDF',
        path: '/tools/other/images-to-pdf',
        icon: <Image />,
        desc: 'Convert images into a single PDF',
      },
      {
        name: 'PDF → Images',
        path: '/tools/other/pdf-to-images',
        icon: <PictureAsPdf />,
        desc: 'Extract all pages as images',
      },
      {
        name: 'Convert to ZIP',
        path: '/tools/other/zip',
        icon: <Archive />,
        desc: 'Zip each file individually',
      },
    ],
  },
];

export default function HomeDashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [recent, setRecent] = useState<{ name: string; path: string }[]>([]);

  // Load "recently used" tools from localStorage
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('recentTools') || '[]');
    setRecent(saved);
  }, []);

  const handleToolClick = (tool: { name: string; path: string }) => {
    // Save to localStorage
    const existing = JSON.parse(localStorage.getItem('recentTools') || '[]');
    const updated = [
      tool,
      ...existing.filter((t: any) => t.path !== tool.path),
    ].slice(0, 6);
    localStorage.setItem('recentTools', JSON.stringify(updated));
    navigate(tool.path);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
        pb: 10,
        bgcolor: 'transparent',
        px: { xs: 2, sm: 4, md: 6 },
      }}
    >
      {/* Animated Background Gradient */}
      {/* <motion.div
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          background:
            theme.palette.mode === 'light'
              ? 'linear-gradient(-45deg, #ff9a9e, #fad0c4, #a1c4fd, #c2e9fb)'
              : 'linear-gradient(-45deg, #232526, #414345, #1e3c72, #2a5298)',
          backgroundSize: '400% 400%',
          opacity: 0.25,
        }}
      /> */}

      {/* Animated Background Gradient */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          background:
            theme.palette.mode === 'light'
              ? 'linear-gradient(-45deg, #ff9a9e, #fad0c4, #a1c4fd, #c2e9fb)'
              : 'linear-gradient(-45deg, #141E30, #243B55, #0F2027, #2C5364)',
          backgroundSize: '400% 400%',
          animation: 'gradientMove 20s ease infinite',
        }}
      />

      <style>
        {`
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}
      </style>

      {/* Quick Actions Section */}
      {recent.length > 0 && (
        <Stack spacing={1.5} sx={{ mb: 4 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <History fontSize="small" />
            <Typography variant="h6">Quick Actions</Typography>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            {recent.map(tool => (
              <Chip
                key={tool.path}
                label={tool.name}
                variant="outlined"
                onClick={() => navigate(tool.path)}
                clickable
              />
            ))}
          </Stack>
        </Stack>
      )}

      {/* Tools Section */}
      <Stack spacing={5}>
        {tools.map(section => (
          <div key={section.category}>
            {/* Section Header */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ mb: 2 }}
            >
              <Avatar
                sx={{
                  bgcolor: 'transparent',
                  color: 'text.primary',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {section.icon}
              </Avatar>
              <Typography
                variant="h5"
                sx={{
                  background: section.color,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 600,
                }}
              >
                {section.category}
              </Typography>
            </Stack>

            {/* Tool Cards */}
            <Grid container spacing={3}>
              {section.items.map(tool => (
                <Grid item xs={12} sm={6} md={4} key={tool.name}>
                  <motion.div
                    whileHover={{
                      scale: 1.04,
                    }}
                    style={{
                      borderRadius: '1.2rem', // match your theme radius
                      overflow: 'hidden', // ✅ this clips the shadow and content
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)', // base shadow
                    }}
                  >
                    <Card
                      variant="outlined"
                      sx={{
                        height: '100%',
                        borderRadius: 3,
                        bgcolor: 'background.paper',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      <CardActionArea
                        sx={{ height: '100%', p: 2 }}
                        onClick={() => handleToolClick(tool)}
                      >
                        <CardContent>
                          <Stack spacing={1.5} alignItems="flex-start">
                            {tool.icon}
                            <Typography variant="h6">{tool.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {tool.desc}
                            </Typography>
                          </Stack>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </div>
        ))}
      </Stack>
    </Box>
  );
}
