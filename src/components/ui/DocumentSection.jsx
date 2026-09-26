import { Paper, Stack, Typography } from '@mui/material';

export default function DocumentSection({ title, description, actions, children, sx }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, ...sx }}>
      <Stack spacing={1.5}>
        {(title || description || actions) && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
            <Stack spacing={0.25}>
              {title && <Typography component="h2" variant="h6" fontWeight={800}>{title}</Typography>}
              {description && <Typography variant="body2" color="text.secondary">{description}</Typography>}
            </Stack>
            {actions}
          </Stack>
        )}
        {children}
      </Stack>
    </Paper>
  );
}
