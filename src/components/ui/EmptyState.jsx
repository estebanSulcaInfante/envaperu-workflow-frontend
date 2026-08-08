import { Box, Paper, Stack, Typography } from '@mui/material';

function EmptyState({ icon, title, description, action }) {
  return (
    <Paper variant="outlined" sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
      <Stack alignItems="center" spacing={1} sx={{ maxWidth: 620, mx: 'auto', textAlign: 'center' }}>
        {icon && (
          <Box sx={{ color: 'text.disabled', '& svg': { fontSize: 42 } }}>
            {icon}
          </Box>
        )}
        <Typography variant="h6" component="h2" fontWeight={850}>{title}</Typography>
        {description && <Typography variant="body2" color="text.secondary">{description}</Typography>}
        {action && <Box sx={{ pt: 1 }}>{action}</Box>}
      </Stack>
    </Paper>
  );
}

export default EmptyState;
