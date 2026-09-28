import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import ViewListIcon from "@mui/icons-material/ViewList";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PageHeader from "./ui/PageHeader";
import SearchableMultiSelect from "./ui/SearchableMultiSelect";
import MangaHistoryDetailScm from "./MangaHistoryDetailScm";
import { useScmActor } from "../context/ScmActorContext";
import {
  exportarProduccionHistoricaScm,
  listarProduccionHistoricaScm,
} from "../services/scmProductionObservabilityApi";
import { formatGrams, formatKg } from "../utils/weightDisplay";
import {
  GROUP_LABELS,
  GROUP_OPTIONS,
  MEASURE_LABELS,
  MEASURE_OPTIONS,
  hasMeasureSelection,
  parseProductionHistoryParams,
  sameProductionHistoryFilters,
  serializeProductionHistoryFilters,
  validateProductionHistoryFilters,
} from "../models/productionHistoryFilters";

const groupOptions = GROUP_OPTIONS.map((value) => ({
  value,
  label: GROUP_LABELS[value] || value,
}));
const measureOptions = MEASURE_OPTIONS.map((value) => ({
  value,
  label: MEASURE_LABELS[value] || value,
}));

const formatMeasure = (item = {}, measure) => {
  if (measure === "MANGAS") return item[measure] ?? "—";
  if (measure === "P_UNITARIO_G") return formatGrams(item[measure]);
  return formatKg(item[measure]);
};

const originalTitle = (item, measure) => {
  if (item?.[measure] == null || measure === "MANGAS") return undefined;
  const unit = measure === "P_UNITARIO_G" ? "g" : "kg";
  return `${item[measure]} ${unit} (valor original)`;
};

const displayArticle = (item = {}, showCode = true) => {
  const name = item.ARTICULO_NOMBRE;
  const code = item.ARTICULO_CODIGO || item.ARTICULO;
  if (!name && !code) return "—";
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2" fontWeight={700}>
        {name || "Artículo sin nombre"}
      </Typography>
      {showCode && code && (
        <Typography variant="caption" color="text.secondary">
          {code}
        </Typography>
      )}
    </Stack>
  );
};

const renderGroupValue = (item = {}, group, showCode = true) =>
  group === "ARTICULO" ? displayArticle(item, showCode) : item[group] || "—";

const flattenHierarchy = (nodes, expanded, depth = 0) =>
  (nodes || []).flatMap((node) => [
    { node, depth },
    ...(expanded.has(node.id)
      ? flattenHierarchy(node.children, expanded, depth + 1)
      : []),
  ]);

const collectNodeIds = (nodes = []) =>
  nodes.flatMap((node) => [node.id, ...collectNodeIds(node.children)]);
const nodeHasChildren = (node) =>
  Array.isArray(node?.children) && node.children.length > 0;
const nodeGroupPath = (node) => {
  try {
    return node?.id ? JSON.parse(node.id) : [];
  } catch {
    return [];
  }
};

const nodeLabel = (node, showCode = true) => {
  if (!node) return "—";
  if (node.dimension === "ARTICULO")
    return renderGroupValue(
      node.item || { ARTICULO: node.value },
      "ARTICULO",
      showCode,
    );
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2" fontWeight={700}>
        {node.value || "—"}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {GROUP_LABELS[node.dimension] || node.dimension}
      </Typography>
    </Stack>
  );
};

const mangaCountLabel = (value) => {
  if (value === null || value === undefined || value === "")
    return "Consultar mangas";
  const count = Number(value);
  if (!Number.isFinite(count)) return "Consultar mangas";
  return `${count} ${count === 1 ? "manga" : "mangas"}`;
};

const mangaContextLabel = (node, item, groups) => {
  if (node)
    return `${GROUP_LABELS[node.dimension] || node.dimension} ${node.value ?? "sin valor"}`;
  const context = groups
    .map(
      (group) =>
        `${GROUP_LABELS[group] || group} ${item?.[group] ?? "sin valor"}`,
    )
    .join(", ");
  return context || "total general";
};

const coverageLabel = (coverage) =>
  ({ COMPLETA: "Completos", INCOMPLETA: "Incompletos" })[coverage] ||
  "Sin datos";

const getCoverageTitle = (coverage) =>
  coverage == null
    ? "Datos de peso: no hay evidencia de cobertura en esta fila."
    : `Datos de peso: ${coverageLabel(coverage)}. Cobertura indica integridad de atribución de los pesos incluidos, no avance ni cumplimiento de meta.`;

const measureTitle = (item, measure) => {
  const original = originalTitle(item, measure);
  if (
    measure === "PESO_KG" &&
    item?.SUBTOTAL_CONOCIDO_KG != null &&
    item.coverage !== "COMPLETA"
  ) {
    return `${item.SUBTOTAL_CONOCIDO_KG} kg conocidos en los pesos incluidos; cobertura incompleta. La ausencia no equivale a cero.`;
  }
  return original;
};

function SummaryCard({ summary, measures, showQuality, onMangasClick }) {
  if (!summary) return null;
  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ sm: "center" }}
      >
        <Box sx={{ minWidth: 150 }}>
          <Typography variant="h6">Total general</Typography>
        </Box>
        {measures.map((measure) => (
          <Box key={measure} title={originalTitle(summary, measure)}>
            <Typography variant="caption" color="text.secondary">
              {MEASURE_LABELS[measure] || measure}
            </Typography>
            {measure === "MANGAS" && onMangasClick ? (
              <Button
                size="small"
                onClick={onMangasClick}
                aria-label={`${mangaCountLabel(summary.MANGAS)} del grupo total general`}
              >
                {mangaCountLabel(summary.MANGAS)}
              </Button>
            ) : (
              <Typography
                variant="body1"
                fontWeight={700}
                align={measure === "MANGAS" ? "center" : "right"}
              >
                {formatMeasure(summary, measure)}
              </Typography>
            )}
          </Box>
        ))}
        {showQuality && (
          <Box title={getCoverageTitle(summary.coverage)}>
            <Typography variant="caption" color="text.secondary">
              Datos de peso
            </Typography>
            <Typography variant="body1" fontWeight={700}>
              {coverageLabel(summary.coverage)}
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

export default function ProductionHistoryScm() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() =>
    parseProductionHistoryParams(searchParams),
  );
  const [appliedFilters, setAppliedFilters] = useState(() =>
    parseProductionHistoryParams(searchParams),
  );
  const [items, setItems] = useState([]);
  const [hierarchy, setHierarchy] = useState(null);
  const [summary, setSummary] = useState(null);
  const [visibility, setVisibility] = useState(null);
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [exportError, setExportError] = useState("");
  const [exportState, setExportState] = useState("idle");
  const [measureError, setMeasureError] = useState("");
  const [hasAppliedResult, setHasAppliedResult] = useState(false);
  const [appliedAt, setAppliedAt] = useState(null);
  const [viewMode, setViewMode] = useState("grouped");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [displayColumns, setDisplayColumns] = useState({
    measures: Object.fromEntries(
      MEASURE_OPTIONS.map((measure) => [measure, true]),
    ),
    codes: true,
    quality: true,
  });
  const [mangaDialog, setMangaDialog] = useState({ open: false, group: [] });
  const requestSequence = useRef(0);
  const requestController = useRef(null);
  const exportSequence = useRef(0);
  const exportController = useRef(null);
  const sharedUrl = useRef(null);
  const initialUrl = useRef(true);
  const { actorId, can } = useScmActor();
  const activeActor = useRef(actorId);
  activeActor.current = actorId;
  const canExport = can("OT_VER") && can("MANGA_PESAJE_VER");

  const share = (next) => {
    const params = serializeProductionHistoryFilters(next);
    sharedUrl.current = new URLSearchParams(params).toString();
    setSearchParams(params, { replace: true });
  };

  const load = async (nextFilters = filters) => {
    share(nextFilters);
    const validationError = validateProductionHistoryFilters(nextFilters);
    if (validationError || !hasMeasureSelection(nextFilters)) {
      requestSequence.current += 1;
      requestController.current?.abort();
      requestController.current = null;
      setFilterError(
        validationError || "Selecciona al menos una medida para consultar.",
      );
      setMeasureError(
        !validationError && !hasMeasureSelection(nextFilters)
          ? "Selecciona al menos una medida para consultar."
          : "",
      );
      setState(hasAppliedResult ? "ready" : "idle");
      return false;
    }
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setState("loading");
    setError("");
    setFilterError("");
    setMeasureError("");
    setExportError("");
    setExportState("idle");
    try {
      const payload = await listarProduccionHistoricaScm({
        ...nextFilters,
        signal: controller.signal,
      });
      if (sequence !== requestSequence.current) return false;
      const nextHierarchy = Array.isArray(payload?.jerarquia)
        ? payload.jerarquia
        : null;
      setItems(payload?.items || []);
      setHierarchy(nextHierarchy);
      setSummary(payload?.resumen || null);
      setVisibility(payload?.visibilidad || null);
      setExpandedIds(new Set((nextHierarchy || []).map((node) => node.id)));
      setAppliedFilters({
        ...nextFilters,
        agrupaciones: [...nextFilters.agrupaciones],
        medidas: [...nextFilters.medidas],
      });
      setHasAppliedResult(true);
      setAppliedAt(new Date());
      setState("ready");
      return true;
    } catch (cause) {
      if (controller.signal.aborted || sequence !== requestSequence.current)
        return false;
      setError(
        cause?.response?.data?.error?.message ||
          cause?.response?.data?.message ||
          "No se pudo cargar el histórico.",
      );
      setState("error");
      return false;
    }
  };

  useEffect(() => {
    const urlKey = searchParams.toString();
    if (initialUrl.current) {
      initialUrl.current = false;
      load(parseProductionHistoryParams(searchParams));
      return undefined;
    }
    if (urlKey === sharedUrl.current) {
      sharedUrl.current = null;
      return undefined;
    }
    const next = parseProductionHistoryParams(searchParams);
    setFilters(next);
    load(next);
    return undefined;
    // URL navigation restores the query; explicit form edits only submit via Buscar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const previousActor = useRef(actorId);
  useEffect(() => {
    if (previousActor.current === actorId) return;
    previousActor.current = actorId;
    requestSequence.current += 1;
    requestController.current?.abort();
    requestController.current = null;
    setItems([]);
    setHierarchy(null);
    setSummary(null);
    setVisibility(null);
    setHasAppliedResult(false);
    setAppliedAt(null);
    exportSequence.current += 1;
    exportController.current?.abort();
    exportController.current = null;
    setExportState("idle");
    setState("idle");
    load(appliedFilters);
    // Actor changes invalidate the prior response before re-querying.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId]);

  useEffect(
    () => () => {
      exportSequence.current += 1;
      exportController.current?.abort();
    },
    [],
  );

  const update = (key) => (event) => {
    setFilters((current) => ({ ...current, [key]: event.target.value }));
    if (key === "medidas") setMeasureError("");
  };
  const updateSelection = (key) => (selection) => {
    setFilters((current) => ({ ...current, [key]: selection }));
    if (key === "medidas") setMeasureError("");
  };
  const search = () => load(filters);
  const exportFile = async () => {
    if (exportDisabled) return;
    const sequence = exportSequence.current + 1;
    exportSequence.current = sequence;
    exportController.current?.abort();
    const controller = new AbortController();
    exportController.current = controller;
    const requestedActor = actorId;
    setExportError("");
    setExportState("loading");
    try {
      const response = await exportarProduccionHistoricaScm({
        ...appliedFilters,
        signal: controller.signal,
      });
      if (
        controller.signal.aborted ||
        sequence !== exportSequence.current ||
        requestedActor !== activeActor.current
      )
        return;
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "produccion-historica.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
      setExportState("success");
    } catch (cause) {
      if (
        controller.signal.aborted ||
        sequence !== exportSequence.current ||
        requestedActor !== activeActor.current
      )
        return;
      setExportError(
        cause?.response?.data?.error?.message ||
          cause?.response?.data?.message ||
          "No se pudo exportar el histórico.",
      );
      setExportState("error");
    }
  };
  const removeChip = (key, value) =>
    setFilters((current) => ({
      ...current,
      [key]: Array.isArray(current[key])
        ? current[key].filter((item) => item !== value)
        : "",
    }));

  const appliedMeasures = useMemo(
    () => appliedFilters.medidas || [],
    [appliedFilters.medidas],
  );
  const appliedGroups = useMemo(
    () => appliedFilters.agrupaciones || [],
    [appliedFilters.agrupaciones],
  );
  const pendingChanges =
    hasAppliedResult && !sameProductionHistoryFilters(filters, appliedFilters);
  const exportDisabled =
    !canExport ||
    state === "loading" ||
    exportState === "loading" ||
    !hasAppliedResult ||
    visibility?.pesaje === false;
  const hierarchyAvailable =
    Array.isArray(hierarchy) && (hierarchy.length > 0 || items.length === 0);
  const groupedVisible =
    viewMode === "grouped" && appliedGroups.length > 0 && hierarchyAvailable;
  const effectiveViewMode = groupedVisible ? "grouped" : "flat";
  const visibleRows = groupedVisible
    ? flattenHierarchy(hierarchy, expandedIds)
    : items.map((item) => ({ node: null, item, depth: 0 }));
  const tableHeaders = useMemo(
    () => [
      ...(groupedVisible
        ? [{ key: "tree", label: "Agrupación" }]
        : appliedGroups.map((group) => ({
            key: group,
            label: GROUP_LABELS[group] || group,
          }))),
      ...appliedMeasures
        .filter((measure) => displayColumns.measures[measure] !== false)
        .map((measure) => ({
          key: measure,
          label: MEASURE_LABELS[measure] || measure,
          align: measure === "MANGAS" ? "center" : "right",
        })),
      ...(displayColumns.quality
        ? [{ key: "coverage", label: "Datos de peso" }]
        : []),
    ],
    [appliedGroups, appliedMeasures, displayColumns, groupedVisible],
  );

  const toggleNode = (id) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const expandAll = () =>
    setExpandedIds(new Set(collectNodeIds(hierarchy || [])));
  const collapseAll = () => setExpandedIds(new Set());
  const openMangaDialog = (node, item) =>
    setMangaDialog({
      open: true,
      group:
        !node && item === summary
          ? []
          : groupedVisible
            ? nodeGroupPath(node)
            : appliedGroups.map((dimension) => ({
                dimension,
                value: item?.[dimension] ?? null,
              })),
    });
  const renderMangaAccess = (node, item) => {
    const label = mangaCountLabel(item?.MANGAS);
    const context = mangaContextLabel(node, item, appliedGroups);
    return (
      <Button
        size="small"
        onClick={() => openMangaDialog(node, item)}
        aria-label={`${label} del grupo ${context}`}
      >
        {label}
      </Button>
    );
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 1500, mx: "auto" }}>
      <PageHeader
        title="Histórico de producción"
        description="Rango operativo America/Lima · atribución trazable por tramo"
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<RefreshIcon />}
              variant="contained"
              onClick={search}
              disabled={state === "loading"}
            >
              Buscar
            </Button>
            <Button
              startIcon={<DownloadIcon />}
              variant="outlined"
              onClick={exportFile}
              disabled={exportDisabled}
            >
              Exportar
            </Button>
          </Stack>
        }
      />
      <Paper variant="outlined" sx={{ p: 1.5, my: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          flexWrap="wrap"
          useFlexGap
        >
          <TextField
            size="small"
            type="date"
            label="Desde"
            InputLabelProps={{ shrink: true }}
            value={filters.desde}
            onChange={update("desde")}
          />
          <TextField
            size="small"
            type="date"
            label="Hasta"
            InputLabelProps={{ shrink: true }}
            value={filters.hasta}
            onChange={update("hasta")}
          />
          <TextField
            size="small"
            label="Buscar"
            value={filters.q}
            onChange={update("q")}
          />
          <SearchableMultiSelect
            label="Agrupar"
            options={groupOptions}
            value={filters.agrupaciones}
            onApply={updateSelection("agrupaciones")}
            immediate
          />
          <SearchableMultiSelect
            label="Medidas"
            options={measureOptions}
            value={filters.medidas}
            onApply={updateSelection("medidas")}
            immediate
            helperText={measureError}
          />
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 1 }}
        >
          {filters.q && (
            <Chip
              label={`Buscar: ${filters.q}`}
              onDelete={() => removeChip("q")}
            />
          )}
          {filters.agrupaciones.map((value) => (
            <Chip
              key={`g-${value}`}
              label={`Agrupar: ${GROUP_LABELS[value] || value}`}
              onDelete={() => removeChip("agrupaciones", value)}
            />
          ))}
          {filters.medidas.map((value) => (
            <Chip
              key={`m-${value}`}
              label={`Medida: ${MEASURE_LABELS[value] || value}`}
              onDelete={() => removeChip("medidas", value)}
            />
          ))}
        </Stack>
        <Typography
          variant="caption"
          color={pendingChanges ? "warning.main" : "text.secondary"}
          display="block"
          sx={{ mt: 1 }}
        >
          {pendingChanges
            ? "Hay cambios pendientes de aplicar. Pulsa Buscar para actualizar la consulta."
            : "La tabla y Excel usan la última consulta aplicada."}
        </Typography>
      </Paper>
      {visibility?.pesaje === false && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Visibilidad de pesos restringida: se requiere MANGA_PESAJE_VER. La
          estructura y los objetivos pueden permanecer disponibles.
        </Alert>
      )}
      {error && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              onClick={search}
              disabled={state === "loading"}
            >
              Reintentar consulta
            </Button>
          }
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}
      {filterError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {filterError}
        </Alert>
      )}
      {exportError && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              onClick={exportFile}
              disabled={exportDisabled}
            >
              Reintentar exportación
            </Button>
          }
          sx={{ mb: 2 }}
        >
          {exportError}
        </Alert>
      )}
      {exportState === "success" && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Exportación iniciada para la consulta aplicada.
        </Alert>
      )}
      {state === "loading" && (
        <Paper
          variant="outlined"
          sx={{ p: 1, mb: 1, display: "flex", alignItems: "center", gap: 1 }}
        >
          <CircularProgress size={18} aria-label="Cargando histórico" />
          <Typography variant="body2">Consultando el histórico…</Typography>
        </Paper>
      )}
      {hasAppliedResult && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mb: 1 }}
        >
          Consulta aplicada: {appliedFilters.desde} a {appliedFilters.hasta}
          {appliedAt
            ? ` · ${appliedAt.toLocaleTimeString("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit" })}`
            : ""}
          {appliedFilters.q ? ` · búsqueda: ${appliedFilters.q}` : ""} ·
          agrupación:{" "}
          {appliedGroups.length
            ? appliedGroups
                .map((group) => GROUP_LABELS[group] || group)
                .join(", ")
            : "Total general"}{" "}
          · {items.length} filas devueltas
        </Typography>
      )}
      {hasAppliedResult && (
        <SummaryCard
          summary={summary}
          measures={appliedMeasures}
          showQuality={displayColumns.quality}
          onMangasClick={() => openMangaDialog(null, summary)}
        />
      )}
      {hasAppliedResult && appliedGroups.length > 0 && !hierarchyAvailable && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Vista agrupada no disponible. Se muestra la tabla plana.
        </Alert>
      )}
      {hasAppliedResult && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ mb: 1 }}
          alignItems={{ sm: "center" }}
        >
          <Typography variant="body2" fontWeight={700} sx={{ mr: 1 }}>
            Vista
          </Typography>
          <Button
            size="small"
            variant={effectiveViewMode === "grouped" ? "contained" : "outlined"}
            startIcon={<AccountTreeIcon />}
            onClick={() => setViewMode("grouped")}
            disabled={!hierarchyAvailable || appliedGroups.length === 0}
            aria-label="Vista agrupada"
            aria-pressed={effectiveViewMode === "grouped"}
          >
            Agrupada
          </Button>
          <Button
            size="small"
            variant={effectiveViewMode === "flat" ? "contained" : "outlined"}
            startIcon={<ViewListIcon />}
            onClick={() => setViewMode("flat")}
            aria-label="Vista plana"
            aria-pressed={effectiveViewMode === "flat"}
          >
            Plana
          </Button>
          {groupedVisible && (
            <>
              <Button size="small" onClick={expandAll}>
                Expandir todos
              </Button>
              <Button size="small" onClick={collapseAll}>
                Contraer todos
              </Button>
            </>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<ViewColumnIcon />}
            onClick={() => setColumnDialogOpen(true)}
          >
            Columnas
          </Button>
        </Stack>
      )}
      {state !== "loading" &&
        !items.length &&
        hasAppliedResult &&
        visibility?.pesaje !== false && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
            {appliedFilters.q ? (
              <>
                <Typography>
                  No hay resultados para “{appliedFilters.q}”.
                </Typography>
                <Button
                  size="small"
                  onClick={() =>
                    setFilters((current) => ({ ...current, q: "" }))
                  }
                >
                  Limpiar búsqueda
                </Button>
              </>
            ) : (
              "No hay producción en el rango seleccionado."
            )}
          </Paper>
        )}
      {items.length > 0 && (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ overflowX: "auto" }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                {tableHeaders.map(({ key, label, align }) => (
                  <TableCell key={key} align={align}>
                    {label}
                  </TableCell>
                ))}
                {(displayColumns.measures.MANGAS === false ||
                  !appliedMeasures.includes("MANGAS")) && (
                  <TableCell>Mangas</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map(({ node, item: rowItem, depth }) => {
                const item = node?.item || rowItem || {};
                return (
                  <TableRow
                    key={
                      node?.id ||
                      `${depth}-${appliedGroups.map((group) => item[group]).join("-")}`
                    }
                  >
                    {groupedVisible ? (
                      <TableCell sx={{ pl: Math.min(1 + depth * 2, 8) }}>
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                        >
                          {nodeHasChildren(node) ? (
                            <Button
                              size="small"
                              onClick={() => toggleNode(node.id)}
                              aria-label={`${expandedIds.has(node.id) ? "Contraer" : "Expandir"} ${node.dimension === "ARTICULO" ? node.item?.ARTICULO_NOMBRE || node.value : node.value}`}
                              aria-expanded={expandedIds.has(node.id)}
                              sx={{ minWidth: 28, p: 0.25 }}
                            >
                              {expandedIds.has(node.id) ? (
                                <ExpandMoreIcon />
                              ) : (
                                <ChevronRightIcon />
                              )}
                            </Button>
                          ) : (
                            <Box
                              aria-hidden="true"
                              sx={{ width: 28, flexShrink: 0 }}
                            />
                          )}
                          <Box>{nodeLabel(node, displayColumns.codes)}</Box>
                        </Stack>
                      </TableCell>
                    ) : (
                      <>
                        {appliedGroups.map((group) => (
                          <TableCell key={group}>
                            {renderGroupValue(
                              item,
                              group,
                              displayColumns.codes,
                            )}
                          </TableCell>
                        ))}
                      </>
                    )}
                    {appliedMeasures
                      .filter(
                        (measure) => displayColumns.measures[measure] !== false,
                      )
                      .map((measure) => (
                        <TableCell
                          key={measure}
                          align={measure === "MANGAS" ? "center" : "right"}
                          title={measureTitle(item, measure)}
                          aria-label={
                            measure === "MANGAS" && item?.MANGAS != null
                              ? String(item.MANGAS)
                              : undefined
                          }
                        >
                          {measure === "MANGAS"
                            ? renderMangaAccess(node, item)
                            : formatMeasure(item, measure)}
                        </TableCell>
                      ))}
                    {displayColumns.quality && (
                      <TableCell title={getCoverageTitle(item.coverage)}>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={coverageLabel(item.coverage)}
                          color={
                            item.coverage === "COMPLETA" ? "success" : "warning"
                          }
                        />
                      </TableCell>
                    )}
                    {(displayColumns.measures.MANGAS === false ||
                      !appliedMeasures.includes("MANGAS")) && (
                      <TableCell>{renderMangaAccess(node, item)}</TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog
        open={columnDialogOpen}
        onClose={() => setColumnDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="history-columns-title"
      >
        <DialogTitle id="history-columns-title">Columnas</DialogTitle>
        <DialogContent dividers>
          <FormGroup>
            {appliedMeasures.map((measure) => (
              <FormControlLabel
                key={measure}
                control={
                  <Checkbox
                    checked={displayColumns.measures[measure] !== false}
                    onChange={(event) =>
                      setDisplayColumns((current) => ({
                        ...current,
                        measures: {
                          ...current.measures,
                          [measure]: event.target.checked,
                        },
                      }))
                    }
                  />
                }
                label={MEASURE_LABELS[measure] || measure}
              />
            ))}
            <FormControlLabel
              control={
                <Checkbox
                  checked={displayColumns.codes}
                  onChange={(event) =>
                    setDisplayColumns((current) => ({
                      ...current,
                      codes: event.target.checked,
                    }))
                  }
                />
              }
              label="Códigos"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={displayColumns.quality}
                  onChange={(event) =>
                    setDisplayColumns((current) => ({
                      ...current,
                      quality: event.target.checked,
                    }))
                  }
                />
              }
              label="Datos de peso"
            />
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setColumnDialogOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
      <MangaHistoryDetailScm
        open={mangaDialog.open}
        onClose={() =>
          setMangaDialog((current) => ({ ...current, open: false }))
        }
        filters={appliedFilters}
        group={mangaDialog.group}
        actorId={actorId}
      />
    </Box>
  );
}
