import { useEffect, useId, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { obtenerOtScm } from '../services/scmOtApi';

const asText = (value) => (value === null || value === undefined ? '' : String(value).trim());

const firstText = (...values) => values.map(asText).find(Boolean) || '';

const identityOf = (manga) => firstText(
  manga?.public_id,
  manga?.id,
  manga?.manga_id,
  manga?.manga?.public_id,
  manga?.manga?.id,
);

const codeOf = (manga) => firstText(
  manga?.codigo,
  manga?.code,
  manga?.manga_codigo,
  manga?.codigo_manga,
  manga?.manga?.codigo,
);

const workIdentity = (work) => firstText(work?.public_id, work?.id, work?.trabajo_color_id, work?.trabajo_id);

const workIdentityOf = (manga) => firstText(
  manga?.trabajo_color_id,
  manga?.trabajo_color_actual_id,
  manga?.trabajo_id,
  manga?.trabajo_ot_id,
  manga?.trabajo?.public_id,
  manga?.trabajo?.id,
  manga?.trabajo_color?.public_id,
  manga?.trabajo_color?.id,
);

const outputIdentity = (output) => firstText(
  output?.public_id,
  output?.id,
  output?.pieza_id,
  output?.articulo_id,
  output?.salida_id,
  output?.codigo,
);

const outputIdOf = (manga) => firstText(
  manga?.output_id,
  manga?.outputId,
  manga?.salida_id,
  manga?.orden_operacion_salida_id,
  manga?.lote_salida_pieza_color_id,
  manga?.plan_linea_id,
  manga?.plan_linea?.salida_id,
  manga?.plan_linea?.orden_operacion_salida_id,
  manga?.salida?.public_id,
  manga?.salida?.id,
  manga?.salida?.pieza_id,
);

const outputRowsOf = (work) => [
  ...(Array.isArray(work?.salidas) ? work.salidas : []),
  ...(Array.isArray(work?.articulos_salida) ? work.articulos_salida : []),
  ...(Array.isArray(work?.salidas_produccion) ? work.salidas_produccion : []),
  ...(Array.isArray(work?.salidas_color) ? work.salidas_color : []),
  ...(Array.isArray(work?.salidas_pieza) ? work.salidas_pieza : []),
].map((output) => ({ id: outputIdentity(output), label: firstText(output?.nombre, output?.descripcion, output?.codigo, outputIdentity(output)), output }))
  .filter((output, index, rows) => output.id && rows.findIndex((candidate) => candidate.id === output.id) === index);

const resolveOutputId = (manga, work) => {
  const explicit = outputIdOf(manga);
  const outputs = outputRowsOf(work);
  if (explicit) {
    const direct = outputs.find((output) => output.id === explicit);
    if (direct) return direct.id;
    if (!outputs.length) return explicit;
  }
  const mangaOutputKey = firstText(manga?.pieza_color_sku, manga?.pieza_color_sku_snapshot, manga?.salida_codigo);
  if (mangaOutputKey) {
    const matches = outputs.filter((output) => [
      output.output?.pieza_color_sku,
      output.output?.pieza_color_sku_snapshot,
      output.output?.codigo,
      output.output?.sku,
      output.output?.subtipo?.pieza_color_sku,
    ].map(asText).includes(mangaOutputKey));
    if (matches.length === 1) return matches[0].id;
  }
  return outputs.length === 1 ? outputs[0].id : '';
};

const labelIdsOf = (manga) => [
  manga?.label_id,
  manga?.labelId,
  manga?.etiqueta_id,
  manga?.etiqueta_vigente?.public_id,
  manga?.etiqueta_vigente?.id,
  manga?.etiqueta_vigente?.label_id,
  manga?.etiqueta_vigente?.payload?.label_id,
  manga?.etiqueta_vigente?.payload?.qr?.label_id,
  manga?.label?.public_id,
  manga?.label?.id,
  manga?.label?.payload?.label_id,
].map(asText).filter(Boolean);

const mangaRowsOf = (work, ot) => {
  const workMangas = [work?.mangas, work?.mangas_resumen].find(Array.isArray);
  if (workMangas) {
    const selectedWorkId = workIdentity(work);
    return workMangas.filter((manga) => {
      const mangaWorkId = workIdentityOf(manga);
      return !mangaWorkId || !selectedWorkId || mangaWorkId === selectedWorkId;
    });
  }
  const otMangas = [ot?.mangas, ot?.mangas_resumen].find(Array.isArray);
  if (!otMangas) return [];
  const selectedWorkId = workIdentity(work);
  return otMangas.filter((manga) => workIdentityOf(manga) === selectedWorkId);
};

const selectedWorkFromOt = (ot, work) => {
  const selectedId = workIdentity(work);
  const payload = ot?.ot || ot;
  const works = [payload?.trabajos_color, payload?.trabajos_color_resumen, payload?.trabajos].find(Array.isArray) || [];
  return works.find((candidate) => workIdentity(candidate) === selectedId);
};

const buildCandidate = (manga, work, index) => {
  const id = identityOf(manga);
  const code = codeOf(manga);
  const outputId = resolveOutputId(manga, work);
  if (!id || !code || !outputId) return null;
  return {
    id,
    code,
    outputId,
    labelIds: labelIdsOf(manga),
    source: manga,
    index,
    outputLabel: outputRowsOf(work).find((output) => output.id === outputId)?.label || outputId,
  };
};

const parseMangaQr = (rawValue) => {
  const raw = asText(rawValue);
  if (!raw) return null;
  if (raw.startsWith('{')) {
    try {
      const payload = JSON.parse(raw);
      const labelId = firstText(payload?.label_id, payload?.labelId, payload?.qr?.label_id, payload?.qr?.labelId);
      if (labelId) return { kind: 'label', value: labelId };
      const mangaId = firstText(payload?.manga_id, payload?.mangaId, payload?.manga?.public_id, payload?.manga?.id);
      if (mangaId) return { kind: 'id', value: mangaId };
    } catch {
      return null;
    }
  }
  const labelMatch = raw.match(/^(?:L1(?:[/:|]|\s)|label_id\s*[:=])(.+)$/i);
  if (labelMatch?.[1]) return { kind: 'label', value: asText(labelMatch[1]) };
  return { kind: 'id-or-code', value: raw };
};

const compactRecord = (candidate) => ({ id: candidate.id, code: candidate.code, outputId: candidate.outputId });

const resolveMangaSelection = (rawValue, candidates, allCandidates = candidates) => {
  const parsed = parseMangaQr(rawValue);
  if (!parsed) return { error: 'El código o QR está vacío o no es válido.' };
  const matches = candidates.filter((candidate) => (
    parsed.kind === 'label'
      ? candidate.labelIds.includes(parsed.value)
      : candidate.id === parsed.value || candidate.code === parsed.value
  ));
  if (matches.length === 0) {
    const restrictedMatch = allCandidates.filter((candidate) => (
      parsed.kind === 'label'
        ? candidate.labelIds.includes(parsed.value)
        : candidate.id === parsed.value || candidate.code === parsed.value
    ));
    if (restrictedMatch.length === 1) {
      return { error: 'La manga pertenece a una pieza/salida distinta de la incidencia y no se puede vincular aquí.' };
    }
    if (restrictedMatch.length > 1) return { error: 'El código identifica más de una manga; selecciónala desde la lista.' };
    return { error: 'La manga no pertenece al trabajo o no se pudo resolver con este QR.' };
  }
  if (matches.length > 1) return { error: 'El código identifica más de una manga; selecciónala desde la lista.' };
  return { candidate: matches[0] };
};

const valueRecord = (entry) => ({ id: asText(entry?.id), code: asText(entry?.code || entry?.codigo), outputId: asText(entry?.outputId || entry?.output_id) });

function QualityAffectedMangas({ ot, work, value = [], onChange, disabled = false, allowedOutputIds }) {
  const titleId = useId();
  const [fetchedMangas, setFetchedMangas] = useState([]);
  const [fetchedWork, setFetchedWork] = useState(null);
  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState('');
  const [error, setError] = useState('');

  const otPayload = useMemo(() => ot?.ot || ot, [ot]);
  const sourceWork = useMemo(() => selectedWorkFromOt(otPayload, work) || work, [otPayload, work]);
  const hasWorkMangaList = Array.isArray(sourceWork?.mangas) || Array.isArray(sourceWork?.mangas_resumen);
  const hasOtMangaList = Array.isArray(otPayload?.mangas) || Array.isArray(otPayload?.mangas_resumen);
  useEffect(() => {
    if (hasWorkMangaList || hasOtMangaList) return undefined;
    const otId = firstText(otPayload?.public_id, otPayload?.id);
    if (!otId) {
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    queueMicrotask(() => {
      if (active) setLoading(true);
    });
    obtenerOtScm(otId, { signal: controller.signal })
      .then((detail) => {
        if (!active) return;
        const detailOt = detail?.ot || detail;
        const detailWork = selectedWorkFromOt(detailOt, work);
        setFetchedWork(detailWork || null);
        setFetchedMangas(mangaRowsOf(detailWork, detailOt));
      })
      .catch((requestError) => {
        if (active && requestError?.name !== 'CanceledError' && requestError?.name !== 'AbortError') {
          setError('No se pudo cargar el listado de mangas; verifica la conexión e inténtalo otra vez.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [hasOtMangaList, hasWorkMangaList, otPayload, work]);

  const allCandidates = useMemo(() => {
    const candidateWork = hasWorkMangaList || hasOtMangaList ? sourceWork : (fetchedWork || sourceWork);
    const rows = hasWorkMangaList || hasOtMangaList ? mangaRowsOf(candidateWork, otPayload) : fetchedMangas;
    return rows.map((manga, index) => buildCandidate(manga, candidateWork, index)).filter(Boolean);
  }, [fetchedMangas, fetchedWork, hasOtMangaList, hasWorkMangaList, otPayload, sourceWork]);
  const allowedOutputSet = useMemo(() => (
    Array.isArray(allowedOutputIds) ? new Set(allowedOutputIds.map(asText)) : null
  ), [allowedOutputIds]);
  const candidates = useMemo(() => (
    allowedOutputSet === null
      ? allCandidates
      : allCandidates.filter((candidate) => allowedOutputSet.has(asText(candidate.outputId)))
  ), [allCandidates, allowedOutputSet]);

  const selectedRecords = useMemo(() => (Array.isArray(value) ? value : []).map(valueRecord).filter((record) => record.id), [value]);
  const selectedOptions = useMemo(() => selectedRecords.map((record) => candidates.find((candidate) => candidate.id === record.id) || {
    ...record,
    outputLabel: 'Identidad guardada (sin lista cargada)',
  }), [candidates, selectedRecords]);

  const emitCandidates = (nextCandidates) => {
    const unique = [];
    nextCandidates.forEach((candidate) => {
      if (!candidate || unique.some((current) => current.id === candidate.id)) return;
      unique.push(candidate);
    });
    onChange?.(unique.map(compactRecord));
  };

  const addCandidate = (candidate) => {
    if (!candidate) return;
    if (selectedRecords.some((record) => record.id === candidate.id)) {
      setError('La manga ya está vinculada.');
      return;
    }
    setError('');
    const current = selectedRecords.map((record) => candidates.find((item) => item.id === record.id) || record);
    emitCandidates([...current, candidate]);
    setEntry('');
  };

  const addEntry = () => {
    const result = resolveMangaSelection(entry, candidates, allCandidates);
    if (result.error) {
      setError(result.error);
      return;
    }
    addCandidate(result.candidate);
  };

  return (
    <Paper component="section" variant="outlined" aria-labelledby={titleId} data-testid="quality-affected-mangas" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
      <Stack spacing={1.5}>
        <Box>
          <Typography id={titleId} variant="h6">Mangas afectadas</Typography>
          <Typography variant="body2" color="text.secondary">Opcional: selecciona o escanea las mangas afectadas por esta incidencia.</Typography>
        </Box>
        <Autocomplete
          multiple
          disableCloseOnSelect
          options={candidates}
          value={selectedOptions}
          loading={loading}
          disabled={disabled || loading}
          getOptionLabel={(option) => `${option.code} · ${option.outputLabel}`}
          isOptionEqualToValue={(option, selected) => option.id === selected.id}
          onChange={(_, nextOptions) => {
            setError('');
            emitCandidates(nextOptions);
          }}
          renderTags={(tagValue, getTagProps) => tagValue.map((option, index) => (
            <Chip
              {...getTagProps({ index })}
              key={option.id}
              label={option.code}
              variant="outlined"
              disabled={disabled}
              aria-label={`Eliminar ${option.code}`}
            />
          ))}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Mangas afectadas de este trabajo"
              placeholder={loading ? 'Cargando mangas…' : 'Selecciona una o varias'}
              inputProps={{ ...params.inputProps, 'aria-description': 'La lista solo contiene mangas pertenecientes al trabajo seleccionado.' }}
              InputProps={{ ...params.InputProps, endAdornment: <>{loading ? <CircularProgress color="inherit" size={18} /> : null}{params.InputProps.endAdornment}</> }}
            />
          )}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
          <TextField
            fullWidth
            size="small"
            label="Código o QR de manga"
            value={entry}
            disabled={disabled || loading}
            onChange={(event) => setEntry(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addEntry();
              }
            }}
            helperText="Pega el código humano o el QR L1/label_id y pulsa Enter."
          />
          <Button variant="outlined" onClick={addEntry} disabled={disabled || loading || !entry.trim()} sx={{ minHeight: 40, whiteSpace: 'nowrap' }}>Agregar manga</Button>
        </Stack>
        {error ? <Alert severity="error" role="alert">{error}</Alert> : null}
        {!loading && !candidates.length && !error ? <Typography variant="body2" color="text.secondary">No hay mangas resolubles para este trabajo.</Typography> : null}
      </Stack>
    </Paper>
  );
}

export default QualityAffectedMangas;
