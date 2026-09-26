import { Box, Chip, Paper, Stack, Typography } from '@mui/material';

export default function DocumentHeader({
  eyebrow,
  title,
  subtitle,
  status,
  backAction,
  actions,
}) {
  return (
    <Paper
      component="header"
      variant="outlined"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        p: { xs: 1.5, md: 2 },
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          {backAction}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {eyebrow && <Typography variant="overline" color="text.secondary">{eyebrow}</Typography>}
            <Typography component="h1" variant="h5" fontWeight={850} noWrap>
              {title}
            </Typography>
            {subtitle && <Box sx={{ mt: 0.25 }}>{subtitle}</Box>}
          </Box>
          {status}
        </Stack>
        {actions && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ sm: 'center' }}
            sx={{ flexWrap: 'wrap' }}
          >
            {actions}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

export function DocumentStatus({ label, color = 'default' }) {
  return <Chip size="small" label={label} color={color} />;
}
