export function fieldErrorProps(errors, field) {
  const message = errors?.[field] || '';
  return { error: Boolean(message), helperText: message || undefined };
}
