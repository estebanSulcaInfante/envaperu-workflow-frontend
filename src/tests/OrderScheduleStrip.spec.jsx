import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import OrderScheduleStrip from '../components/ui/OrderScheduleStrip';

describe('Franja temporal de OF y OA', () => {
  it('mantiene compatibilidad con el estado plano SIN_PROGRAMAR', () => {
    render(<OrderScheduleStrip order={{
      fecha_necesidad: '2026-08-15',
      rango_fechas_ot: { desde: null, hasta: null, cantidad: 0 },
      programacion_estado: 'SIN_PROGRAMAR',
    }} />);

    const strip = screen.getByTestId('order-schedule-strip');
    expect(within(strip).getByText('Sin jornada')).toBeVisible();
    expect(strip).not.toHaveTextContent('Jornadas OT:');
  });

  it('explica cuando la demanda no aportó una fecha de necesidad', () => {
    render(<OrderScheduleStrip order={{
      contexto_temporal: {
        fecha_necesidad_min: null,
        fecha_necesidad_max: null,
        fecha_necesidad_motivo: 'SIN_DEMANDA_FECHADA',
        fecha_ot_primera: null,
        fecha_ot_ultima: null,
        programacion_estado: 'SIN_JORNADA',
        cantidad_ot: 0,
      },
    }} />);

    expect(screen.getByTestId('order-schedule-strip'))
      .toHaveTextContent(/Necesidad: Sin demanda fechada/);
  });
});
