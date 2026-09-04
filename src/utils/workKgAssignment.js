// Decimal strings and integer arithmetic avoid silently rounding discrete units.
const decimal = (value) => {
  const text = String(value ?? '').trim().replace(',', '.');
  if (text.length > 80 || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return { n: BigInt((whole || '0') + fraction), d: 10n ** BigInt(fraction.length), places: fraction.length };
};
const scaled = (value, places) => {
  const digits = value.toString().padStart(places + 1, '0');
  const result = places ? `${digits.slice(0, -places)}.${digits.slice(-places)}` : digits;
  return result.includes('.') ? result.replace(/0+$/, '').replace(/\.$/, '') : result;
};
export const formatPlanningKg = (value) => {
  if (value == null) return '—';
  const [whole, fraction = ''] = String(value).split('.');
  return `${whole},${fraction.padEnd(2, '0')}`;
};

export function buildKgAssignment({ line, run, initialUnits = 0, edit }) {
  const output = line.orden_operacion_salida_id && run?.salidas?.find(
    (item) => String(item.id) === String(line.orden_operacion_salida_id),
  );
  const weight = decimal(output?.peso_unitario_snapshot_g);
  const saldo = Number(line.saldo_un);
  const capacity = Number(line.capacidad_efectiva_un);
  if (!weight?.n || !Number.isSafeInteger(saldo) || saldo < 0
    || !Number.isSafeInteger(capacity) || capacity <= 0) {
    return { valid: false, units: 0, error: 'No hay peso congelado o capacidad válida para esta salida. Revisa la OF y el plan de mangas.', input: edit?.text ?? '' };
  }
  const kgFor = (units) => scaled(weight.n * BigInt(units), weight.places + 3);
  const initial = Number(initialUnits);
  const input = edit ? edit.text : (Number.isSafeInteger(initial) && initial >= 0 ? kgFor(initial) : '');
  const base = { input, pendingKg: kgFor(saldo), capacityKg: kgFor(capacity), unitWeightG: scaled(weight.n, weight.places), valid: false, units: 0 };
  const requested = decimal(input);
  if (!requested) return { ...base, error: 'Ingresa kg válidos, usando coma o punto decimal.' };
  const numerator = requested.n * 1000n * weight.d;
  const denominator = requested.d * weight.n;
  const lower = numerator / denominator;
  const remainder = numerator % denominator;
  if (lower > BigInt(Number.MAX_SAFE_INTEGER)) return { ...base, error: 'La cantidad supera el saldo disponible.' };
  const options = remainder ? [
    { choice: 'lower', units: Number(lower), kg: kgFor(lower) },
    { choice: 'upper', units: Number(lower + 1n), kg: kgFor(lower + 1n) },
  ].map((option) => ({ ...option, allowed: option.units > 0 && option.units <= saldo })) : [];
  const chosen = remainder ? options.find((option) => option.choice === edit?.choice && option.allowed) : null;
  const units = remainder ? chosen?.units : Number(lower);
  if (units == null) return { ...base, needsChoice: true, options,
    error: options.some((option) => option.allowed) ? null : 'Las cantidades cercanas superan el saldo disponible.' };
  if (units > saldo) return { ...base, error: 'La cantidad supera el saldo disponible.' };
  const partialUnits = units % capacity;
  const difference = weight.n * BigInt(units) * requested.d - requested.n * weight.d * 1000n;
  const differenceKg = `${difference < 0n ? '-' : '+'}${scaled(difference < 0n ? -difference : difference, weight.places + requested.places + 3)}`;
  return { ...base, valid: true, units, options, chosen: chosen?.choice,
    differenceKg,
    appliedKg: kgFor(units), fullBags: Math.floor(units / capacity),
    partialUnits, partialKg: kgFor(partialUnits), totalBags: Math.ceil(units / capacity) };
}
