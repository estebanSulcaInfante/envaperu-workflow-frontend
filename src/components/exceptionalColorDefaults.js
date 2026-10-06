// A color is a single objective, even when several mold pieces produce it.
// Missing configuration remains visible for review; never invent a kg target.
export const exceptionalColorIds = (mold, colors = []) => {
  if (mold?.activo === false) return [];
  const inactive = new Set(colors.filter((color) => color.activo === false).map((color) => String(color.id)));
  return [...new Set((mold?.formas || [])
    .filter((shape) => shape.activo !== false)
    .flatMap((shape) => shape.variantes || [])
    .filter((variant) => variant.activo !== false
      && Number(variant.color_produccion_id) > 0
      && !inactive.has(String(variant.color_produccion_id)))
    .map((variant) => String(variant.color_produccion_id)))];
};
