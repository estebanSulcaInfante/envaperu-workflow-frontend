import { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Stack } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { CatalogManagementPanel } from './Us10aOperations';
import PageHeader from './ui/PageHeader';
import { obtenerRecepcionMateriales } from '../services/recepcionMateriales';

function MaterialCatalogPage() {
  const [searchParams] = useSearchParams();
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState('');
  const catalogKind = searchParams.get('catalogo') || 'materials';

  useEffect(() => {
    obtenerRecepcionMateriales()
      .then(setWorkspace)
      .catch(() => setError('No se pudo cargar el prototipo de catálogos.'));
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!workspace) return <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  return (
    <Stack spacing={2.25} sx={{ maxWidth: 1440, mx: 'auto' }}>
      <PageHeader
        eyebrow="Datos maestros"
        title="Materiales y abastecimiento"
        description="Materias primas, proveedores, ubicaciones y reglas reutilizadas por el flujo de recepción."
      />
      <CatalogManagementPanel
        key={catalogKind}
        workspace={workspace}
        onWorkspaceChange={setWorkspace}
        initialKind={catalogKind}
      />
    </Stack>
  );
}

export default MaterialCatalogPage;
