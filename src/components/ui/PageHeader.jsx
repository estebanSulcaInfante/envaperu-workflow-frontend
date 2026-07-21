import { Box, Stack, Typography } from '@mui/material';

function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      alignItems={{ md: 'flex-end' }}
      spacing={1.5}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && <Typography variant="overline" color="primary" sx={{ fontWeight: 800 }}>{eyebrow}</Typography>}
        <Typography component="h1" variant="h4" sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 850 }}>
          {title}
        </Typography>
        {description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{description}</Typography>}
      </Box>
      {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
    </Stack>
  );
}

export default PageHeader;
