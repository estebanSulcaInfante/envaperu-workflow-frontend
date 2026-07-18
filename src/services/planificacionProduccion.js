import { planificacionProduccionMock } from '../mocks/planificacionProduccion';

export const PLANIFICACION_PRODUCCION_SOURCE = 'MOCK';

const asNumber = (value) => Number(value || 0);

export const calcularLineaDemanda = (linea) => {
  const cantidadSolicitada = Math.max(0, asNumber(linea.cantidadSolicitada));
  const stockPtAsignado = Math.min(cantidadSolicitada, Math.max(0, asNumber(linea.stockPtAsignado)));

  return {
    ...linea,
    cantidadSolicitada,
    stockPtAsignado,
    cantidadPorArmar: cantidadSolicitada - stockPtAsignado,
  };
};

export const calcularNecesidadPiezaColor = ({ necesidad, linea, inventarioDisponible }) => {
  const cantidadBruta = linea.cantidadPorArmar * asNumber(necesidad.cantidadPorPt);

  if (!inventarioDisponible) {
    return {
      ...necesidad,
      cantidadBruta,
      faltanteNeto: null,
      objetivoProduccion: null,
      calculable: false,
    };
  }

  const stockDisponible = Math.max(0, asNumber(necesidad.stockDisponible));
  const suministroLiberado = Math.max(0, asNumber(necesidad.suministroLiberado));
  const contingencia = Math.max(0, asNumber(necesidad.contingencia));
  const faltanteNeto = Math.max(0, cantidadBruta - stockDisponible - suministroLiberado);

  return {
    ...necesidad,
    cantidadBruta,
    stockDisponible,
    suministroLiberado,
    contingencia,
    faltanteNeto,
    objetivoProduccion: faltanteNeto + contingencia,
    calculable: true,
  };
};

export const calcularPropuestaMolde = (propuesta, necesidadesPorId) => {
  const objetivos = propuesta.salidas
    .map((salida) => {
      const necesidad = necesidadesPorId.get(salida.necesidadId);
      if (!necesidad?.calculable) return null;
      return Math.ceil(necesidad.objetivoProduccion / Math.max(1, asNumber(salida.cavidades)));
    })
    .filter((value) => value !== null);

  const ciclos = objetivos.length > 0 ? Math.max(...objetivos) : 0;
  const salidas = propuesta.salidas.map((salida) => {
    const necesidad = necesidadesPorId.get(salida.necesidadId);
    const cantidadPlanificada = ciclos * Math.max(1, asNumber(salida.cavidades));
    const faltanteNeto = necesidad?.faltanteNeto || 0;
    const objetivoProduccion = necesidad?.objetivoProduccion || 0;

    return {
      ...salida,
      faltanteNeto,
      contingencia: necesidad?.contingencia || 0,
      objetivoProduccion,
      cantidadPlanificada,
      excedenteTecnico: Math.max(0, cantidadPlanificada - objetivoProduccion),
      excesoTotal: Math.max(0, cantidadPlanificada - faltanteNeto),
    };
  });

  return {
    ...propuesta,
    ciclos,
    salidas,
    contingenciaTotal: salidas.reduce((total, salida) => total + salida.contingencia, 0),
    excedenteTecnicoTotal: salidas.reduce((total, salida) => total + salida.excedenteTecnico, 0),
    kgNetos: salidas.reduce(
      (total, salida) => total + (salida.cantidadPlanificada * asNumber(salida.pesoUnitarioGr)) / 1000,
      0,
    ),
  };
};

export const calcularSolicitudProduccion = (solicitud) => {
  const lineas = solicitud.lineas.map(calcularLineaDemanda);
  const lineasPorId = new Map(lineas.map((linea) => [linea.id, linea]));
  const inventarioDisponible = solicitud.inventario.estado === 'DISPONIBLE';
  const necesidades = solicitud.necesidades.map((necesidad) => calcularNecesidadPiezaColor({
    necesidad,
    linea: lineasPorId.get(necesidad.lineaId),
    inventarioDisponible,
  }));
  const necesidadesPorId = new Map(necesidades.map((necesidad) => [necesidad.id, necesidad]));
  const propuestas = inventarioDisponible
    ? solicitud.propuestas.map((propuesta) => calcularPropuestaMolde(propuesta, necesidadesPorId))
    : [];

  return {
    ...solicitud,
    lineas,
    necesidades,
    propuestas,
    totalSolicitado: lineas.reduce((total, linea) => total + linea.cantidadSolicitada, 0),
    totalPorArmar: lineas.reduce((total, linea) => total + linea.cantidadPorArmar, 0),
    faltanteTotal: necesidades.reduce((total, necesidad) => total + (necesidad.faltanteNeto || 0), 0),
    kgNetosPropuestos: propuestas.reduce((total, propuesta) => total + propuesta.kgNetos, 0),
  };
};

export const obtenerPlanificacionProduccion = async () => {
  const workspace = structuredClone(planificacionProduccionMock);
  const solicitudes = workspace.solicitudes.map(calcularSolicitudProduccion);

  return {
    ...workspace,
    solicitudes,
    resumen: {
      solicitudesActivas: solicitudes.filter((item) => !['CUBIERTA', 'CANCELADA'].includes(item.estado)).length,
      unidadesSolicitadas: solicitudes.reduce((total, item) => total + item.totalSolicitado, 0),
      propuestasOp: solicitudes.reduce((total, item) => total + item.propuestas.length, 0),
      bloqueos: solicitudes.filter((item) => item.bloqueos.length > 0).length,
    },
  };
};
