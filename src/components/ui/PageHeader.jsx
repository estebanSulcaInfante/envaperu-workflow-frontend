import { Box, Stack, Typography } from '@mui/material';

function PageHeader({ title, description, actions }) {
  return (
    <Stack
      component="header"
      direction={{ xs: 'column', lg: 'row' }}
      justifyContent="space-between"
      alignItems={{ lg: 'flex-end' }}
      spacing={1.25}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h1" variant="h4" sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 850 }}>
          {title}
        </Typography>
        {description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.375, maxWidth: 960, lineHeight: 1.5 }}
          >
            {description}
          </Typography>
        )}
      </Box>
      {actions && (
        <Box
          sx={{
            flexShrink: 0,
            width: { xs: '100%', lg: 'auto' },
            '& > .MuiStack-root': { flexWrap: 'wrap' },
          }}
        >
          {actions}
        </Box>
      )}
    </Stack>
  );
}

export default PageHeader;
