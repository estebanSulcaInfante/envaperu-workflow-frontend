import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  listarMangasHistoricoScm,
  obtenerDetalleMangaScm,
} from "../services/scmProductionObservabilityApi";
import { formatGrams, formatKg } from "../utils/weightDisplay";
import ProductionColorLabel from "./ui/ProductionColorLabel";

const sectionOrder = [
  "identidad",
  "documentos",
  "tramos",
  "pesajes_correcciones_reaperturas",
  "stock_movimientos",
  "etiquetas",
  "genealogia",
];
const sectionTitle = {
  identidad: "Identidad",
  documentos: "Documentos y continuidad",
  tramos: "Tramos de trabajo",
  pesajes_correcciones_reaperturas: "Pesajes, correcciones y reaperturas",
  stock_movimientos: "Custodia y movimientos",
  etiquetas: "Etiquetas",
  genealogia: "Genealogía",
};
const statusLabel = {
  disponible: "Disponible",
  sin_datos: "Sin evidencia disponible",
  restringido: "Restringido para este actor",
};
const humanStatusLabels = {
  PENDIENTE_RECEPCION_ALMACEN: "Pendiente de recepción en almacén",
  PLAN_CONFIRMADO_POR_PESAJE:
    "Plan confirmado por pesaje (unidades de referencia; no es conteo físico)",
  PESADA: "Pesada",
  VIGENTE: "Vigente",
  ANULADA: "Anulada",
  APLICADA: "Aplicada",
  historica: "Histórica",
  vigente: "Vigente",
  restringido: "Restringido",
  sin_datos: "Sin evidencia disponible",
};
const humanizeStatus = (value) => humanStatusLabels[value] || value;
const restrictionReason = (reason) => {
  const value = String(reason || "");
  if (value.includes("MANGA_PESAJE_VER"))
    return "Los pesos requieren una autorización de consulta que el actor actual no tiene.";
  if (value.includes("warehouse_scope"))
    return "La ubicación está fuera del alcance autorizado para el actor actual.";
  if (value.includes("GENEALOGIA_VER"))
    return "La genealogía requiere una autorización de consulta que el actor actual no tiene.";
  return value;
};
const fieldLabels = {
  codigo: "Código",
  nombre: "Nombre",
  color: "Color",
  estado: "Estado",
  tipo: "Tipo",
  version: "Versión",
  of: "OF",
  ot: "OT",
  trabajo: "Trabajo",
  fecha_productiva: "Fecha productiva",
  timestamp: "Fecha de registro",
  updated_at: "Última actualización",
  objetivo_color: "Objetivo de color",
  maquina: "Máquina",
  responsable: "Responsable",
  confirmacion_armado: "Confirmación de armado",
  secuencia: "Tramo",
  cantidad_inicio_un: "Unidades iniciales",
  cantidad_fin_un: "Unidades finales",
  cantidad_atribuida_un: "Unidades atribuidas",
  cantidad_inicio_kg: "Kg iniciales",
  cantidad_fin_kg: "Kg finales",
  cantidad_atribuida_kg: "Aporte atribuido",
  calidad_evidencia_kg: "Calidad de evidencia",
  iniciada_at: "Inicio",
  cerrada_at: "Cierre",
  motivo_cierre: "Motivo de cierre",
  pesada_at: "Fecha de pesaje",
  fecha_local_pesaje: "Fecha local de pesaje",
  pesado_at: "Fecha de control",
  peso_fisico_neto_kg: "Peso físico neto (kg)",
  peso_bruto_kg: "Peso bruto (kg)",
  tara_kg: "Tara (kg)",
  fuente_cantidad: "Fuente de cantidad",
  cantidad_confirmada: "Cantidad confirmada (unidades de referencia)",
  kg_produccion_ot: "Producción de OT (kg)",
  kg_fabricacion_estimado: "Fabricación estimada (kg)",
  pesado_por: "Pesado por",
  tipo_manga: "Tipo de manga",
  pieza_color: "Pieza / color",
  unidad: "Unidad",
  cantidad_fisica_kg: "Cantidad física",
  cantidad_reservada_kg: "Cantidad reservada",
  cantidad_fisica_un: "Cantidad física",
  cantidad_reservada_un: "Cantidad reservada",
  estado_logistico: "Estado logístico",
  estado_calidad: "Estado de calidad",
  ubicacion: "Ubicación",
  cantidad_delta: "Variación",
  saldo_fisico_resultante: "Saldo resultante por artículo y ubicación",
  fecha_operativa: "Fecha operativa",
  created_at: "Fecha de registro",
  motivo: "Motivo",
  plantilla_version: "Versión de plantilla",
  generated_at: "Generada",
  printed_at: "Impresión",
  unidad_id: "Unidad física",
  raiz_id: "Unidad raíz",
  padre_id: "Unidad padre",
  division_id: "División",
  kg_entregado: "Kg entregados (kg)",
  kg_verificados: "Kg verificados (kg)",
  conteo_acumulado_un: "Conteo acumulado",
  peso_neto_kg: "Peso neto (kg)",
  aporte_desde_control_anterior_kg: "Aporte desde control anterior",
  reabierta_at: "Reapertura",
  reabierta_por: "Reabierta por",
  peso_base_neto_kg: "Peso base neto",
  tipo_movimiento: "Movimiento",
  actor: "Responsable",
  confirmado_por: "Confirmado por",
  confirmado_at: "Confirmación",
  solicitada_at: "Solicitada",
  solicitada_por: "Solicitada por",
  resuelta_at: "Resuelta",
  resuelta_por: "Resuelta por",
  anulada_at: "Anulada",
  anulada_por: "Anulada por",
  orden_ensamble: "Orden de ensamble",
  orden_trabajo: "Orden de trabajo",
  cantidad_planificada: "Cantidad planificada",
  cantidad_real: "Cantidad real",
  manga_codigo: "Manga de origen",
  nivel: "Nivel",
  cantidad_incorporada_un: "Cantidad incorporada",
};
const formatDateTime = (value) => {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("es-PE", {
        timeZone: "America/Lima",
        dateStyle: "short",
        timeStyle: "short",
      });
};
const formatValue = (value) =>
  value === null || value === undefined || value === ""
    ? "—"
    : typeof value === "string"
      ? humanizeStatus(value)
      : String(value);
const formatLocation = (value) => {
  if (!value) return "—";
  if (typeof value === "string") return value;
  return (
    [value.codigo, value.nombre, value.ubicacion_codigo]
      .filter(Boolean)
      .join(" · ") || "Ubicación disponible"
  );
};
const formatField = (key, value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "corregida") return value ? "Sí" : "Sin correcciones";
  if (key === "fuente_cantidad") return humanizeStatus(value);
  if (
    key.endsWith("_at") ||
    [
      "fecha_productiva",
      "fecha_operativa",
      "fecha_local_pesaje",
      "created_at",
      "timestamp",
      "updated_at",
    ].includes(key)
  )
    return formatDateTime(value);
  if (
    key.startsWith("kg_") ||
    key.endsWith("_kg") ||
    ["peso_neto_kg", "cantidad_delta", "saldo_fisico_resultante"].includes(key)
  )
    return formatKg(value);
  if (key.endsWith("_g")) return formatGrams(value);
  if (key === "ubicacion") return formatLocation(value);
  return formatValue(value);
};
const labelFor = (key) =>
  fieldLabels[key] ||
  {
    correcciones: "Correcciones",
    anulacion: "Anulación",
    efectivos: "Vigente",
    historicos: "Históricos",
    pesajes: "Pesajes",
    controles_acumulados: "Controles acumulados",
    reaperturas: "Reaperturas",
    movimientos: "Movimientos",
    items: "Registros",
    armado: "Armado",
  }[key] ||
  key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const scalarFields = (value, excluded = []) =>
  Object.entries(value || {}).filter(
    ([key, item]) =>
      !excluded.includes(key) &&
      key !== "id" &&
      key !== "public_id" &&
      !key.endsWith("_id") &&
      !key.toLowerCase().includes("uuid") &&
      item !== null &&
      item !== undefined &&
      item !== "" &&
      typeof item !== "object",
  );

function FieldGrid({ fields }) {
  if (!fields.length) return null;
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          md: "repeat(3, minmax(0, 1fr))",
        },
        gap: 1,
      }}
    >
      {fields.map(([key, value]) => (
        <Box key={key}>
          <Typography variant="caption" color="text.secondary" display="block">
            {labelFor(key)}
          </Typography>
          <Typography variant="body2">{formatField(key, value)}</Typography>
        </Box>
      ))}
    </Box>
  );
}
function StateMessage({ value }) {
  if (!value || value.estado === "sin_datos")
    return (
      <Typography color="text.secondary">
        No hay evidencia disponible para esta sección.
      </Typography>
    );
  if (value.estado === "restringido")
    return (
      <Alert severity="info">
        Datos restringidos para el actor actual
        {value.motivo ? `: ${restrictionReason(value.motivo)}` : "."}
      </Alert>
    );
  return null;
}
function IdentityBody({ item }) {
  if (!item) return <StateMessage value={{ estado: "sin_datos" }} />;
  return (
    <Stack spacing={1.5}>
      <FieldGrid fields={scalarFields(item, ["articulo", "tipo_manga"])} />
      <Paper variant="outlined" sx={{ p: 1.25 }}>
        <Typography variant="subtitle2">Artículo</Typography>
        <FieldGrid fields={scalarFields(item.articulo)} />
      </Paper>
      <Paper variant="outlined" sx={{ p: 1.25 }}>
        <Typography variant="subtitle2">Tipo de manga</Typography>
        <FieldGrid fields={scalarFields(item.tipo_manga)} />
      </Paper>
    </Stack>
  );
}
function DocumentsBody({ item }) {
  if (!item) return <StateMessage value={{ estado: "sin_datos" }} />;
  return (
    <Stack spacing={1.5}>
      <Paper variant="outlined" sx={{ p: 1.25 }}>
        <Typography variant="subtitle2">Documento vigente</Typography>
        <FieldGrid fields={scalarFields(item.efectivos)} />
        {item.efectivos?.confirmacion_armado && (
          <Box sx={{ mt: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              Confirmación de armado
            </Typography>
            <FieldGrid
              fields={scalarFields(item.efectivos.confirmacion_armado, [
                "confirmado_por",
              ])}
            />
            {item.efectivos.confirmacion_armado.confirmado_por && (
              <Typography variant="body2">
                Confirmado por:{" "}
                {referenceText(
                  item.efectivos.confirmacion_armado.confirmado_por,
                )}
              </Typography>
            )}
          </Box>
        )}
      </Paper>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Continuidades históricas
        </Typography>
        {item.historicos?.length ? (
          <Stack spacing={1}>
            {item.historicos.map((entry, index) => (
              <Paper
                variant="outlined"
                sx={{ p: 1.25 }}
                key={entry.tramo_id || `${entry.secuencia}-${index}`}
              >
                <FieldGrid fields={scalarFields(entry, ["tramo_id"])} />
              </Paper>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">
            No hay continuidades históricas.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
function TramosBody({ items }) {
  if (!items?.length) return <StateMessage value={{ estado: "sin_datos" }} />;
  return (
    <Stack spacing={1}>
      {items.map((entry, index) => (
        <Paper
          variant="outlined"
          sx={{ p: 1.25 }}
          key={entry.id || `${entry.secuencia}-${index}`}
        >
          <Typography variant="subtitle2" gutterBottom>
            Tramo {entry.secuencia ?? index + 1} · {formatValue(entry.estado)}
          </Typography>
          <FieldGrid
            fields={scalarFields(entry, ["id", "secuencia", "estado"])}
          />
        </Paper>
      ))}
    </Stack>
  );
}
function WeighingBody({ value }) {
  const pesajes = value?.pesajes || [];
  const controles = value?.controles_acumulados || [];
  const vigente = value?.vigente;
  const cierresControl = value?.cierres_control || [];
  const reaperturas = value?.reaperturas || [];
  if (
    !vigente &&
    !pesajes.length &&
    !controles.length &&
    !cierresControl.length &&
    !reaperturas.length
  )
    return <StateMessage value={{ estado: "sin_datos" }} />;
  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Peso físico vigente
        </Typography>
        {vigente ? (
          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <FieldGrid fields={scalarFields(vigente, ["pesaje_id"])} />
          </Paper>
        ) : (
          <Typography color="text.secondary">
            No hay peso físico vigente.
          </Typography>
        )}
      </Box>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Pesajes físicos
        </Typography>
        {pesajes.length ? (
          <Stack spacing={1}>
            {pesajes.map((entry, index) => (
              <Paper
                variant="outlined"
                sx={{ p: 1.25 }}
                key={entry.id || index}
              >
                <Typography variant="body2" fontWeight={700}>
                  Pesaje {index + 1} · {formatValue(entry.estado)}
                </Typography>
                <FieldGrid
                  fields={scalarFields(entry, [
                    "id",
                    "estado",
                    "correcciones",
                    "anulacion",
                  ])}
                />
                {entry.correcciones?.length ? (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Correcciones
                    </Typography>
                    {entry.correcciones.map((correction, correctionIndex) => (
                      <Paper
                        variant="outlined"
                        sx={{ p: 1, mt: 0.75 }}
                        key={correction.id || correctionIndex}
                      >
                        <Typography variant="body2" fontWeight={700}>
                          Corrección {correctionIndex + 1} ·{" "}
                          {formatValue(correction.estado)}
                        </Typography>
                        <FieldGrid
                          fields={scalarFields(correction, [
                            "id",
                            "estado",
                            "solicitada_por",
                            "resuelta_por",
                            "resultado",
                          ])}
                        />
                        {correction.solicitada_por && (
                          <Typography variant="body2">
                            Solicitada por:{" "}
                            {referenceText(correction.solicitada_por)}
                          </Typography>
                        )}
                        {correction.resuelta_por && (
                          <Typography variant="body2">
                            Resuelta por:{" "}
                            {referenceText(correction.resuelta_por)}
                          </Typography>
                        )}
                        {correction.resultado && (
                          <Box sx={{ mt: 0.75 }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Resultado aplicado
                            </Typography>
                            <FieldGrid
                              fields={scalarFields(correction.resultado).filter(
                                ([key]) =>
                                  [
                                    "peso_bruto_kg",
                                    "tara_kg",
                                    "peso_fisico_neto_kg",
                                    "cantidad_confirmada",
                                    "kg_produccion_ot",
                                    "pesada_at",
                                    "fecha_local_pesaje",
                                    "dias_desfase_operativo",
                                    "alerta_fecha",
                                  ].includes(key),
                              )}
                            />
                          </Box>
                        )}
                      </Paper>
                    ))}
                  </Box>
                ) : null}
                {entry.anulacion && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    Anulado: {formatValue(entry.anulacion.motivo)}
                    {entry.anulacion.anulada_at
                      ? ` · ${formatDateTime(entry.anulacion.anulada_at)}`
                      : ""}
                    {entry.anulacion.anulada_por
                      ? ` · Anulada por: ${referenceText(entry.anulacion.anulada_por)}`
                      : ""}
                  </Alert>
                )}
              </Paper>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">
            No hay pesajes físicos registrados.
          </Typography>
        )}
      </Box>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Cierres desde control
        </Typography>
        {cierresControl.length ? (
          <Stack spacing={1}>
            {cierresControl.map((entry, index) => (
              <Paper
                variant="outlined"
                sx={{ p: 1.25 }}
                key={entry.control_id || index}
              >
                <FieldGrid fields={scalarFields(entry, ["control_id"])} />
              </Paper>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">
            No hay cierres desde control.
          </Typography>
        )}
      </Box>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Controles acumulados
        </Typography>
        {controles.length ? (
          <Stack spacing={1}>
            {controles.map((entry, index) => (
              <Paper
                variant="outlined"
                sx={{ p: 1.25 }}
                key={entry.id || index}
              >
                <FieldGrid fields={scalarFields(entry, ["id", "tramo_id"])} />
              </Paper>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">
            No hay controles acumulados.
          </Typography>
        )}
      </Box>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Reaperturas
        </Typography>
        {reaperturas.length ? (
          <Stack spacing={1}>
            {reaperturas.map((entry, index) => (
              <Paper
                variant="outlined"
                sx={{ p: 1.25 }}
                key={entry.id || index}
              >
                <FieldGrid fields={scalarFields(entry, ["id"])} />
              </Paper>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">
            No hay reaperturas registradas.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
function StockBody({ value }) {
  const projectedCustody = Array.isArray(value?.custodia_vigente)
    ? value.custodia_vigente
    : [];
  const legacyItems = Array.isArray(value?.items) ? value.items : [];
  const custodyKey = (entry) =>
    entry.unidad_id ||
    [
      entry.unidad,
      entry.estado,
      entry.cantidad_fisica_kg ?? entry.cantidad_fisica_un ?? "",
      entry.cantidad_reservada_kg ?? entry.cantidad_reservada_un ?? "",
      entry.motivo || "",
      entry.ubicacion?.codigo || "",
    ].join("|");
  const projectedKeys = new Set(projectedCustody.map(custodyKey));
  const items = [
    ...projectedCustody,
    ...legacyItems.filter((entry) => !projectedKeys.has(custodyKey(entry))),
  ];
  const historicalReceipts = value?.recepciones_historicas || [];
  const movements = value?.movimientos || [];
  if (!items.length && !historicalReceipts.length && !movements.length)
    return <StateMessage value={{ estado: "sin_datos" }} />;
  const renderEntry = (entry, index, prefix) => (
    <Paper
      variant="outlined"
      sx={{ p: 1.25 }}
      key={`${prefix}-${entry.unidad || "unidad"}-${entry.unidad_id || index}`}
    >
      <FieldGrid fields={scalarFields(entry, ["ubicacion", "actor"])} />
      {entry.motivo === "remanente_sin_medicion" && (
        <Alert severity="info" sx={{ mt: 1 }}>
          Remanente sin medición; no se infiere consumo ni saldo
        </Alert>
      )}
      {entry.ubicacion && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          <strong>Ubicación:</strong> {formatLocation(entry.ubicacion)}
        </Typography>
      )}
      {entry.actor && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          Responsable: {referenceText(entry.actor)}
        </Typography>
      )}
    </Paper>
  );
  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Recepción original (histórica)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Este registro conserva la recepción original y no representa custodia disponible actual.
        </Typography>
        {historicalReceipts.length ? (
          <Stack spacing={1}>
            {historicalReceipts.map((entry, index) => renderEntry(entry, index, "historical"))}
          </Stack>
        ) : (
          <Typography color="text.secondary">
            No hay recepción histórica autorizada.
          </Typography>
        )}
      </Box>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Custodia vigente
        </Typography>
        {items.length ? (
          <Stack spacing={1}>
            {items.map((entry, index) => renderEntry(entry, index, "current"))}
          </Stack>
        ) : (
          <Typography color="text.secondary">
            No hay custodia vigente autorizada.
          </Typography>
        )}
      </Box>
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Movimientos
        </Typography>
        {movements.length ? (
          <Stack spacing={1}>
            {movements.map((entry, index) => (
              <Paper
                variant="outlined"
                sx={{ p: 1.25 }}
                key={entry.id || index}
              >
                <FieldGrid fields={scalarFields(entry, ["id", "actor"])} />
                {entry.actor && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Responsable: {referenceText(entry.actor)}
                  </Typography>
                )}
              </Paper>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">
            No hay movimientos atribuibles.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
const referenceText = (value) => {
  if (!value) return "—";
  if (typeof value === "string") return value;
  return (
    [value.codigo, value.nombre, value.nombre_completo, value.codigo_raiz]
      .filter(Boolean)
      .join(" · ") || "Referencia disponible"
  );
};

function GenealogyAssembly({ armado }) {
  const origins = Array.isArray(armado?.origen)
    ? armado.origen
    : armado?.origen
      ? [armado.origen]
      : [];
  return (
    <Paper variant="outlined" sx={{ p: 1.25 }}>
      <Typography variant="subtitle2">Armado</Typography>
      <FieldGrid fields={scalarFields(armado, ["origen", "articulo_salida"])} />
      {armado?.articulo_salida && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Artículo de salida
          </Typography>
          <FieldGrid fields={scalarFields(armado.articulo_salida)} />
        </Box>
      )}
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          Origen del armado
        </Typography>
        {origins.length ? (
          <Stack spacing={1} sx={{ mt: 0.5 }}>
            {origins.map((origin, index) => (
              <Paper variant="outlined" sx={{ p: 1 }} key={origin.id || index}>
                {origin.estado === "restringido" ||
                origin.estado === "sin_datos" ? (
                  <StateMessage value={origin} />
                ) : (
                  <>
                    <FieldGrid
                      fields={scalarFields(origin, ["id", "articulo"])}
                    />
                    {origin.articulo && (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        Artículo: {referenceText(origin.articulo)}
                      </Typography>
                    )}
                  </>
                )}
              </Paper>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">
            No hay consumos de origen disponibles.
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

function SimpleItemsBody({ items, kind, section }) {
  if (!items?.length && !section?.armado)
    return <StateMessage value={{ estado: "sin_datos" }} />;
  return (
    <Stack spacing={1}>
      {kind === "genealogia" && section?.armado && (
        <GenealogyAssembly armado={section.armado} />
      )}
      {items.map((entry, index) => (
        <Paper
          variant="outlined"
          sx={{ p: 1.25 }}
          key={entry.id || entry.codigo || index}
        >
          <FieldGrid
            fields={scalarFields(entry, ["id", "raiz", "padre", "armado"])}
          />
          {kind === "genealogia" && entry.raiz && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Unidad raíz: {referenceText(entry.raiz)}
            </Typography>
          )}
          {kind === "genealogia" && entry.padre && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Unidad padre: {referenceText(entry.padre)}
            </Typography>
          )}
          {kind === "genealogia" && entry.armado && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2">Armado</Typography>
              <FieldGrid fields={scalarFields(entry.armado)} />
            </Box>
          )}
        </Paper>
      ))}
    </Stack>
  );
}
function SectionBody({ section, sectionKey }) {
  if (!section || section.estado !== "disponible")
    return <StateMessage value={section} />;
  if (sectionKey === "identidad") return <IdentityBody item={section.item} />;
  if (sectionKey === "documentos") return <DocumentsBody item={section.item} />;
  if (sectionKey === "tramos") return <TramosBody items={section.items} />;
  if (sectionKey === "pesajes_correcciones_reaperturas")
    return <WeighingBody value={section} />;
  if (sectionKey === "stock_movimientos") return <StockBody value={section} />;
  return (
    <SimpleItemsBody
      items={section.items}
      kind={sectionKey}
      section={section}
    />
  );
}
const errorMessage = (cause, fallback) =>
  cause?.response?.data?.error?.message ||
  cause?.response?.data?.message ||
  fallback;
const formatTramos = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return `${value} ${Number(value) === 1 ? "tramo incluido" : "tramos incluidos"}`;
};

export default function MangaHistoryDetailScm({
  open,
  onClose,
  filters,
  group = [],
  actorId = "unknown",
}) {
  const [listState, setListState] = useState("idle");
  const [listError, setListError] = useState("");
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detailState, setDetailState] = useState("idle");
  const [detailError, setDetailError] = useState("");
  const [detail, setDetail] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const listController = useRef(null);
  const detailController = useRef(null);
  const sequence = useRef(0);
  const identityRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const detailTitleRef = useRef(null);
  const dialogContentRef = useRef(null);
  const listItemRefs = useRef(new Map());
  const selectedBeforeDetailRef = useRef(null);
  const listScrollTopRef = useRef(0);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const groupKey = useMemo(() => JSON.stringify(group), [group]);
  const filtersKey = useMemo(
    () =>
      JSON.stringify({
        desde: filters?.desde,
        hasta: filters?.hasta,
        q: filters?.q,
        agrupaciones: filters?.agrupaciones,
        medidas: filters?.medidas,
      }),
    [
      filters?.agrupaciones,
      filters?.desde,
      filters?.hasta,
      filters?.medidas,
      filters?.q,
    ],
  );
  const cancelRequests = useCallback(() => {
    sequence.current += 1;
    listController.current?.abort();
    detailController.current?.abort();
    listController.current = null;
    detailController.current = null;
  }, []);
  const resetData = useCallback(() => {
    setItems([]);
    setSelected(null);
    setDetail(null);
    setListError("");
    setDetailError("");
    setDetailState("idle");
  }, []);
  const loadList = useCallback(async () => {
    cancelRequests();
    const current = sequence.current;
    const controller = new AbortController();
    listController.current = controller;
    setListState("loading");
    resetData();
    try {
      const payload = await listarMangasHistoricoScm(
        { ...filters, signal: controller.signal },
        group,
      );
      if (controller.signal.aborted || current !== sequence.current) return;
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      setItems(nextItems);
      setListState("ready");
      if (nextItems.length === 1) setSelected(nextItems[0]);
    } catch (cause) {
      if (controller.signal.aborted || current !== sequence.current) return;
      setListError(
        errorMessage(cause, "No se pudo cargar la lista de mangas."),
      );
      setListState("error");
    }
  }, [cancelRequests, filters, group, resetData]);
  const loadDetail = useCallback(async (item) => {
    if (!item?.id) return;
    sequence.current += 1;
    detailController.current?.abort();
    const current = sequence.current;
    const controller = new AbortController();
    detailController.current = controller;
    setSelected(item);
    setDetail(null);
    setDetailError("");
    setDetailState("loading");
    try {
      const payload = await obtenerDetalleMangaScm(item.id, {
        signal: controller.signal,
      });
      if (controller.signal.aborted || current !== sequence.current) return;
      setDetail(payload);
      setDetailState("ready");
    } catch (cause) {
      if (controller.signal.aborted || current !== sequence.current) return;
      setDetailError(
        errorMessage(cause, "No se pudo cargar la ficha de manga."),
      );
      setDetailState("error");
    }
  }, []);
  useEffect(() => {
    if (!open) {
      cancelRequests();
      identityRef.current = null;
      return undefined;
    }
    const identity = `${actorId}|${filtersKey}|${groupKey}`;
    if (identityRef.current && identityRef.current !== identity) {
      cancelRequests();
      // Clear sensitive data before closing when actor/query scope changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      resetData();
      onCloseRef.current?.();
      return undefined;
    }
    identityRef.current = identity;
    loadList();
    return () => cancelRequests();
  }, [
    actorId,
    cancelRequests,
    filtersKey,
    groupKey,
    loadList,
    open,
    resetData,
  ]);
  useEffect(() => {
    if (!detail) return undefined;
    const frame = requestAnimationFrame(() => {
      dialogContentRef.current?.scrollTo?.({ top: 0, behavior: "auto" });
      detailTitleRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [detail]);
  useEffect(() => {
    if (
      open &&
      listState === "ready" &&
      items.length === 1 &&
      selected?.id === items[0]?.id &&
      !detail &&
      detailState === "idle"
    )
      // The detail fetch is a remote synchronization; its state transitions
      // are intentionally owned by loadDetail rather than this effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadDetail(items[0]);
  }, [detail, detailState, items, listState, loadDetail, open, selected]);
  const retryDetail = () => loadDetail(selected);
  const openDetail = (item) => {
    selectedBeforeDetailRef.current = item?.id || null;
    listScrollTopRef.current = dialogContentRef.current?.scrollTop || 0;
    loadDetail(item);
  };
  const returnToList = () => {
    const restoreId = selectedBeforeDetailRef.current;
    setDetail(null);
    setDetailState("idle");
    setSelected(null);
    requestAnimationFrame(() => {
      if (dialogContentRef.current?.scrollTo) {
        dialogContentRef.current.scrollTo({
          top: listScrollTopRef.current,
          behavior: "auto",
        });
      }
      listItemRefs.current.get(restoreId)?.focus();
    });
  };
  const detailIdentity = detail?.secciones?.identidad?.item || {};
  const article = detailIdentity.articulo || selected?.articulo || {};
  const sectionData = detail?.secciones || {};
  const weighingSection = sectionData.pesajes_correcciones_reaperturas || {};
  const currentWeighing =
    weighingSection.vigente ||
    (weighingSection.pesajes || []).find(
      (item) => item.estado === "vigente" || item.vigente === true,
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={expanded}
      maxWidth="lg"
      aria-labelledby="manga-history-detail-title"
    >
      <DialogTitle
        id="manga-history-detail-title"
        ref={detailTitleRef}
        tabIndex={-1}
        sx={{ display: "flex", alignItems: "center", gap: 1 }}
      >
        <Box sx={{ flex: 1 }}>Detalle de manga</Box>
        <Button
          size="small"
          onClick={() => setExpanded((value) => !value)}
          startIcon={expanded ? <CloseFullscreenIcon /> : <OpenInFullIcon />}
          aria-label={expanded ? "Reducir ficha" : "Ampliar ficha"}
        >
          {expanded ? "Reducir" : "Ampliar"}
        </Button>
      </DialogTitle>
      <DialogContent ref={dialogContentRef} dividers>
        {listState === "loading" && (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} aria-label="Cargando mangas" />
            <Typography>Consultando mangas…</Typography>
          </Stack>
        )}
        {listState === "error" && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={loadList}>
                Reintentar
              </Button>
            }
          >
            {listError}
          </Alert>
        )}
        {listState === "ready" && !items.length && (
          <Alert severity="info">No hay mangas en esta agrupación.</Alert>
        )}
        {listState === "ready" && items.length > 1 && !detail && (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Mangas incluidas en esta agrupación
            </Typography>
            <List aria-label="Mangas del grupo">
              {items.map((item) => (
                <ListItemButton
                  key={item.id}
                  ref={(node) => {
                    if (node) listItemRefs.current.set(item.id, node);
                    else listItemRefs.current.delete(item.id);
                  }}
                  selected={selected?.id === item.id}
                  onClick={() => openDetail(item)}
                >
                  <ListItemText
                    primary={
                      item.articulo?.nombre || item.codigo || "Manga sin nombre"
                    }
                    secondary={`${item.codigo || "Sin código"} · ${item.color || "Color no indicado"} · aporte en esta consulta: ${formatKg(item.aporte_consulta_kg)} kg · tramos: ${item.tramos_consulta ?? "—"}`}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>
        )}
        {detailState === "loading" && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
            <CircularProgress size={18} aria-label="Cargando ficha" />
            <Typography>Cargando ficha…</Typography>
          </Stack>
        )}
        {detailState === "error" && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={retryDetail}>
                Reintentar ficha
              </Button>
            }
            sx={{ mt: 2 }}
          >
            {detailError}
          </Alert>
        )}
        {detail && (
          <Box sx={{ mt: 1 }}>
            {items.length > 1 && (
              <Button startIcon={<ArrowBackIcon />} onClick={returnToList}>
                Volver a mangas
              </Button>
            )}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ my: 1.5 }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">
                  {article.nombre || selected?.codigo || "Manga sin nombre"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {detailIdentity.codigo || selected?.codigo || "Sin código"} ·{" "}
                  {article.codigo || "Artículo sin código"} · Estado:{" "}
                  {formatValue(detailIdentity.estado || selected?.estado)}
                </Typography>
                <Box sx={{ mt: 0.75 }}>
                  <ProductionColorLabel
                    name={detailIdentity.color_identidad?.nombre || detailIdentity.color || selected?.color || "Color no indicado"}
                    hex={detailIdentity.color_identidad?.hex}
                  />
                </Box>
              </Box>
              <Paper variant="outlined" sx={{ p: 1.25, minWidth: 220 }}>
                <Typography variant="caption" color="text.secondary">
                  Aporte en esta consulta
                </Typography>
                <Typography variant="h6">
                  {formatKg(selected?.aporte_consulta_kg)} kg
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatTramos(selected?.tramos_consulta)}
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.25, minWidth: 220 }}>
                <Typography variant="caption" color="text.secondary">
                  Peso físico vigente
                </Typography>
                <Typography variant="h6">
                  {formatKg(currentWeighing?.peso_fisico_neto_kg)} kg
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {currentWeighing?.pesada_at
                    ? formatDateTime(currentWeighing.pesada_at)
                    : "Sin pesaje vigente disponible"}
                </Typography>
              </Paper>
            </Stack>
            <Alert severity="info" sx={{ mb: 1.5 }}>
              El historial incluye los registros de esta manga, aunque estén
              fuera del rango consultado. El aporte en esta consulta se muestra
              separado de pesajes físicos y controles acumulados.
            </Alert>
            <Divider sx={{ mb: 1 }} />
            {sectionOrder.map((key) => {
              const section = sectionData[key];
              return (
                <Accordion
                  key={key}
                  defaultExpanded={
                    key === "identidad" ||
                    key === "pesajes_correcciones_reaperturas"
                  }
                  disableGutters
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography fontWeight={700}>
                      {sectionTitle[key]}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 1 }}
                    >
                      {statusLabel[section?.estado] || "Sin evidencia"}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <SectionBody section={section} sectionKey={key} />
                  </AccordionDetails>
                </Accordion>
              );
            })}
            {detail.as_of && (
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mt: 1 }}
              >
                Consultado: {formatDateTime(detail.as_of)} (America/Lima)
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
