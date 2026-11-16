export const WEIGHT_OPTIONS = [
  { value: 'CORRECTO', label: 'Peso correcto' },
  { value: 'ALTO', label: 'Peso alto' },
  { value: 'BAJO', label: 'Peso bajo' },
];
export const CYCLE_OPTIONS = [
  { value: 'CORRECTO', label: 'Ciclo correcto' },
  { value: 'LENTO', label: 'Ciclo lento' },
  { value: 'RAPIDO', label: 'Ciclo rápido' },
];
export const WEIGHT_INCIDENT_OPTIONS = WEIGHT_OPTIONS.filter(option => option.value !== 'CORRECTO');
export const CYCLE_INCIDENT_OPTIONS = CYCLE_OPTIONS.filter(option => option.value !== 'CORRECTO');
export const INJECTION_INCIDENT_OPTIONS = [
  { value: 'REBABA', label: 'Rebaba' },
  { value: 'NO_LLENA', label: 'No llena' },
  { value: 'OLEADO', label: 'Oleado' },
  { value: 'DERRETIDO', label: 'Derretido' },
  { value: 'QUEMADO', label: 'Quemado' },
  { value: 'OTROS', label: 'Otros' },
];
export const FUNCTIONAL_INCIDENT_OPTIONS = [
  { value: 'NO_CIERRA_TAPA', label: 'No cierra la tapa' },
  { value: 'NO_HERMETICO', label: 'No es hermético' },
  { value: 'OTROS', label: 'Otros' },
];
export const COLOR_INCIDENT_OPTIONS = [
  { value: 'MUY_CARGADO', label: 'Muy cargado' },
  { value: 'VETEADO', label: 'Veteado' },
  { value: 'PUNTOS_NEGROS', label: 'Puntos negros' },
  { value: 'MANCHAS_BLANCAS', label: 'Manchas blancas' },
  { value: 'NO_ES_EL_COLOR', label: 'No es el color' },
  { value: 'OTROS', label: 'Otros' },
];
