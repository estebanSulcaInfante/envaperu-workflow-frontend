const labelType = (label) => String(
  label?.tipo || label?.tipo_etiqueta || label?.label_type || label?.kind || '',
).toUpperCase();

export const isPostWeighingLabel = (label) => (
  ['POSTPESAJE', 'POST'].includes(labelType(label))
);

export const selectCurrentPostLabel = (detail, manga) => [
  detail?.current_source?.label,
  detail?.current_source?.post_label,
  detail?.post_label,
  detail?.vigente?.etiqueta,
  detail?.etiqueta_vigente,
  manga?.etiqueta_vigente,
].find(isPostWeighingLabel) || null;

export const historyPesajeForLabel = (label) => label?.pesaje || null;

const publicId = (value) => {
  const id = value?.public_id ?? value?.id;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id)) ? String(id) : '';
};

export const buildPostWeighingReprintItem = ({ pesaje, label, copias }) => {
  const pesajeId = publicId(pesaje);
  const sourceLabelId = publicId(label);
  if (labelType(label) !== 'POSTPESAJE' || !pesajeId || !sourceLabelId) return null;
  if (String(label?.estado || '').toUpperCase() !== 'IMPRESA' || !label?.printed_at) return null;
  if (['INVALIDADA', 'ANULADA', 'ANULADO', 'CANCELLED'].includes(String(label?.estado || '').toUpperCase())) return null;
  if (pesaje?.estado !== 'VIGENTE') return null;
  return { pesaje_id: pesajeId, source_label_id: sourceLabelId, copias };
};
