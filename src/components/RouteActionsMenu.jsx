import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, ListItemIcon, ListSubheader, Menu, MenuItem, Stack, Typography,
} from '@mui/material';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import RouteDependencyDialog from './RouteDependencyDialog';

const valueOf = (...values) => values.find((value) => value !== null && value !== undefined && value !== '');

const articleIdOf = (run, selectedRoute) => valueOf(
  selectedRoute?.articulo_salida?.id,
  selectedRoute?.articulo_salida_id,
  run?.salidas?.[0]?.articulo?.id,
  run?.salidas?.[0]?.articulo_scm_id,
  run?.salidas?.[0]?.articulo_id,
  run?.salidas?.[0]?.articulo_salida_id,
);

const revisionIdOf = (selectedRoute, run) => valueOf(
  selectedRoute?.ruta_revision_id,
  run?.operacion_ruta?.ruta_revision_id,
  run?.operacion_ruta?.revision_id,
  run?.ruta_revision_id,
);

const operationIdOf = (selectedRoute, run) => valueOf(
  selectedRoute?.operacion_ruta_revision_id,
  run?.operacion_ruta_revision_id,
  run?.operacion_ruta?.id,
);

const hashOf = (selectedRoute, run) => valueOf(
  run?.operacion_ruta_hash,
  run?.operacion_ruta?.ruta_content_hash,
  run?.operacion_ruta?.content_hash,
  selectedRoute?.ruta_hash,
  selectedRoute?.ruta_content_hash,
);

const revisionNumberOf = (selectedRoute, run, revision, frozen) => valueOf(
  ...(frozen ? [
    run?.operacion_ruta?.ruta_numero_revision,
    run?.operacion_ruta?.numero_revision,
  ] : []),
  selectedRoute?.ruta_numero_revision,
  revision?.numero_revision,
  revision?.revision,
  ...(frozen ? [] : [
    run?.operacion_ruta?.ruta_numero_revision,
    run?.operacion_ruta?.numero_revision,
  ]),
);

const routeHashOf = (revision) => valueOf(revision?.content_hash, revision?.hash);

export function RouteInspectionPanel({
  open,
  onClose,
  run,
  selectedRoute,
  availableRoutes,
  loading,
  error,
  onRefresh,
  frozen = false,
  frozenHash: frozenHashOverride,
  inline = false,
}) {
  const colorName = run?.color_nombre || run?.color?.nombre || run?.color_produccion?.nombre;
  const runContext = [run?.codigo || run?.id, colorName].filter(Boolean).join(' · ');
  const revisionId = revisionIdOf(selectedRoute, run);
  const operationId = operationIdOf(selectedRoute, run);
  // A frozen snapshot may not borrow the currently selected catalog option's
  // hash: that option can represent a newer revision or a new draft choice.
  const frozenHash = frozen
    ? (frozenHashOverride || hashOf(null, run))
    : undefined;
  const revision = availableRoutes.find((item) => String(item?.id ?? item?.revision_id) === String(revisionId));
  const hashMatches = frozen
    ? Boolean(revision && frozenHash && routeHashOf(revision) === frozenHash)
    : Boolean(revision);
  const operationInRevision = revision?.operaciones?.find((item) => String(item?.id) === String(operationId));
  const detailVerified = Boolean(revision && hashMatches && operationInRevision);
  const operation = (detailVerified ? operationInRevision : null)
    || selectedRoute
    || run?.operacion_ruta;
  const revisionNumber = revisionNumberOf(selectedRoute, run, revision, frozen);
  const operations = revision?.operaciones || [];

  const content = (
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
            <Box>
              <Typography variant="body2" color="text.secondary">Consulta de solo lectura · {runContext || 'objetivo'}</Typography>
            </Box>
            <IconButton aria-label="Cerrar detalle de ruta" onClick={onClose} size="small">
              <CloseOutlinedIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Divider />
          {loading && <Alert severity="info">Consultando el detalle disponible de la revisión congelada…</Alert>}
          {error && (
            <Alert
              severity="warning"
              action={<Button color="inherit" size="small" onClick={onRefresh}>Reintentar</Button>}
            >
              No se pudo actualizar el catálogo de rutas: {error}
            </Alert>
          )}
          <Stack spacing={0.5}>
            <Typography variant="body2"><strong>Operación:</strong> {operation?.nombre || operation?.clave || 'No informada'}</Typography>
            <Typography variant="body2"><strong>Proceso:</strong> {operation?.proceso || operation?.tipo || 'No informado'}</Typography>
            <Typography variant="body2"><strong>Revisión</strong> {revisionNumber != null ? revisionNumber : 'No informada'}</Typography>
            {frozenHash && <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>Hash congelado: {frozenHash}</Typography>}
          </Stack>
          {!loading && !revision && (
            <Alert severity="warning">
              Información incompleta: la respuesta disponible no contiene el detalle exacto de la revisión {frozen ? 'congelada' : 'seleccionada'}. No se sustituye por una revisión vigente más nueva.
            </Alert>
          )}
          {!loading && revision && !hashMatches && (
            <Alert severity="warning">
              Información incompleta: {frozenHash
                ? 'el hash recibido no coincide con el snapshot congelado.'
                : 'el snapshot congelado no incluye hash verificable.'} No se muestran operaciones de otra revisión.
            </Alert>
          )}
          {!loading && revision && hashMatches && !operationInRevision && (
            <Alert severity="warning">
              Información incompleta: la revisión coincide, pero no contiene la operación congelada solicitada. No se muestra una operación parecida de otra revisión.
            </Alert>
          )}
          {detailVerified && (
            <>
              <Typography variant="subtitle2" fontWeight={800}>Operaciones de la revisión</Typography>
              {operations.length ? (
                <Stack component="ol" spacing={0.75} sx={{ pl: 2.5, m: 0 }}>
                  {operations.map((item) => (
                    <Box component="li" key={item.id}>
                      <Typography variant="body2" fontWeight={String(item.id) === String(operationId) ? 750 : 400}>
                        {item.nombre || item.clave || `Operación ${item.id}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[item.tipo, item.executor_kind, item.articulo_salida?.codigo || item.articulo_salida?.nombre].filter(Boolean).join(' · ')}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Alert severity="info">La revisión coincide, pero el DTO no incluye operaciones para mostrar.</Alert>
              )}
            </>
          )}
        </Stack>
  );
  if (inline) return <Stack spacing={2}>{content}<Button onClick={onClose} sx={{ alignSelf: 'flex-start' }}>Volver a OF</Button></Stack>;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" transitionDuration={0} aria-labelledby="route-inspection-title">
      <DialogTitle id="route-inspection-title">{frozen ? 'Ruta congelada' : 'Ruta seleccionada'}</DialogTitle>
      <DialogContent dividers>{content}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Volver a OF</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function RouteActionsMenu({
  actionId,
  onInspectRoute,
  run,
  selectedRoute,
  availableRoutes = [],
  canViewRoutes = false,
  canViewArticles = false,
  canAdminRoutes = false,
  loading = false,
  error = '',
  onRefresh,
  frozen = false,
  frozenHash,
  onInspect,
  onAdminRoute,
  orderCode,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [engineeringOpen, setEngineeringOpen] = useState(false);
  const actionsButtonRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const articleId = articleIdOf(run, selectedRoute);
  const directPieceOutputs = (run?.salidas || []).map((item) => item?.articulo)
    .filter((article) => article && !['PRODUCTO_TERMINADO', 'SUBENSAMBLE_WIP'].includes(article.clase));
  const routeTargetArticle = selectedRoute?.articulo_salida
    || (directPieceOutputs.length === 1 ? directPieceOutputs[0] : null);
  const operationSelected = Boolean(selectedRoute || run?.operacion_ruta || run?.operacion_ruta_revision_id);
  const canAdmin = canViewRoutes && canViewArticles && canAdminRoutes
    && (routeTargetArticle?.id != null || directPieceOutputs.length > 0)
    && !['PRODUCTO_TERMINADO', 'SUBENSAMBLE_WIP'].includes(routeTargetArticle?.clase);
  const canInspect = canViewRoutes && operationSelected;
  const menuOpen = Boolean(anchorEl);
  const openEngineering = () => {
    setAnchorEl(null);
    setInspectionOpen(false);
    setEngineeringOpen(true);
  };
  const closeEngineering = () => {
    restoreFocusRef.current = true;
    setEngineeringOpen(false);
  };
  const closeInspection = () => {
    restoreFocusRef.current = true;
    setInspectionOpen(false);
  };
  useEffect(() => {
    if (!engineeringOpen && !inspectionOpen && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      actionsButtonRef.current?.focus();
    }
  }, [engineeringOpen, inspectionOpen]);

  if (!canViewRoutes) return null;

  return (
    <>
      <IconButton
        id={actionId}
        ref={actionsButtonRef}
        size="small"
        aria-label={`Acciones de ruta para ${run?.codigo || run?.id || 'objetivo'}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen ? 'true' : undefined}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{ alignSelf: 'center' }}
      >
        <MoreVertOutlinedIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={() => setAnchorEl(null)}
        MenuListProps={{ 'aria-label': 'Acciones de ruta' }}
      >
        <ListSubheader disableSticky sx={{ lineHeight: 1.4, py: 0.75 }}>
          {[run?.codigo || run?.id, run?.color_nombre || run?.color?.nombre || run?.color_produccion?.nombre]
            .filter(Boolean).join(' · ') || 'Objetivo de fabricación'}
        </ListSubheader>
        <MenuItem
          disabled={!canInspect}
          onClick={() => {
            setAnchorEl(null);
            onInspect?.(run);
            if (onInspectRoute) onInspectRoute();
            else setInspectionOpen(true);
          }}
        >
          <ListItemIcon><VisibilityOutlinedIcon fontSize="small" /></ListItemIcon>
          Ver ruta
        </MenuItem>
        <MenuItem
          component="li"
          disabled={!canAdmin}
          onClick={(event) => {
            if (!canAdmin) event.preventDefault();
            if (canAdmin) {
              setAnchorEl(null);
              if (onAdminRoute) onAdminRoute(run);
              else openEngineering();
            }
          }}
        >
          <ListItemIcon><EngineeringOutlinedIcon fontSize="small" /></ListItemIcon>
          Administrar
        </MenuItem>
        <MenuItem
          disabled={loading || articleId == null}
          onClick={() => {
            setAnchorEl(null);
            onRefresh?.(run);
          }}
        >
          <ListItemIcon><RefreshOutlinedIcon fontSize="small" /></ListItemIcon>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </MenuItem>
      </Menu>
      <RouteInspectionPanel
        open={inspectionOpen}
        onClose={closeInspection}
        run={run}
        selectedRoute={selectedRoute}
        availableRoutes={availableRoutes}
        loading={loading}
        error={error}
        onRefresh={() => onRefresh?.(run)}
        frozen={frozen}
        frozenHash={frozenHash}
      />
      <RouteDependencyDialog
        open={engineeringOpen}
        onClose={closeEngineering}
        run={run}
        selectedRoute={selectedRoute}
        targetArticle={routeTargetArticle}
        articleId={routeTargetArticle?.id}
        canView={canViewRoutes && canViewArticles}
        canAdmin={canAdmin}
        frozen={frozen}
        frozenHash={frozenHash}
        onSaved={() => onRefresh?.(run)}
        orderCode={orderCode || run?.codigo || run?.id}
      />
    </>
  );
}

