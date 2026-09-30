import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MangaHistoryDetailScm from "../components/MangaHistoryDetailScm";
import {
  listarMangasHistoricoScm,
  obtenerDetalleMangaScm,
} from "../services/scmProductionObservabilityApi";

vi.mock("../services/scmProductionObservabilityApi", () => ({
  listarMangasHistoricoScm: vi.fn(),
  obtenerDetalleMangaScm: vi.fn(),
}));

vi.mock("../context/ScmActorContext", () => ({
  useScmActor: () => ({ actorId: 7 }),
}));

const filters = {
  desde: "2026-09-01",
  hasta: "2026-09-28",
  agrupaciones: ["OF"],
  medidas: ["MANGAS", "PESO_KG"],
};

describe("ficha de manga del histórico", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza hechos legibles por sección y separa controles acumulados de aportes", async () => {
    listarMangasHistoricoScm.mockResolvedValue({
      items: [
        {
          id: "manga-publica-1",
          codigo: "M-001",
          color: "Rojo",
          estado: "PESADA",
          articulo: { codigo: "ART-1", nombre: "Artículo de prueba" },
          aporte_consulta_kg: 12.5,
          tramos_consulta: 2,
        },
      ],
      total: 1,
      as_of: "2026-09-28T15:00:00Z",
    });
    obtenerDetalleMangaScm.mockResolvedValue({
      id: "manga-publica-1",
      as_of: "2026-09-28T15:00:00Z",
      secciones: {
        identidad: {
          estado: "disponible",
          item: {
            id: "internal-uuid",
            codigo: "M-001",
            estado: "PENDIENTE_RECEPCION_ALMACEN",
            color: "Rojo",
            articulo: { codigo: "ART-1", nombre: "Artículo de prueba" },
            tipo_manga: { codigo: "SACO", nombre: "Saco" },
          },
        },
        documentos: {
          estado: "disponible",
          item: {
            efectivos: {
              of: "OF-1",
              ot: "OT-1",
              trabajo: "TR-1",
              fecha_productiva: "2026-09-27T15:30:00Z",
              objetivo_color: "Rojo",
              maquina: "M-01",
              responsable: "Ana",
            },
            historicos: [
              {
                tramo_id: "internal-tramo",
                secuencia: 1,
                of: "OF-0",
                ot: "OT-0",
                trabajo: "TR-0",
                estado: "CERRADO",
              },
            ],
          },
        },
        tramos: {
          estado: "disponible",
          items: [
            {
              secuencia: 1,
              estado: "CERRADO",
              cantidad_atribuida_un: 2,
              cantidad_atribuida_kg: 12.5,
              cerrada_at: "2026-09-27T15:30:00Z",
            },
          ],
        },
        pesajes_correcciones_reaperturas: {
          estado: "disponible",
          vigente: {
            estado: "VIGENTE",
            peso_fisico_neto_kg: 12.5,
            peso_bruto_kg: 13.5,
            tara_kg: 1,
            kg_produccion_ot: 80,
            kg_fabricacion_estimado: 80,
            kg_entregado: 80,
            kg_verificados: 80,
            pesada_at: "2026-09-27T15:30:00Z",
            fecha_local_pesaje: "2026-09-27",
            corregida: false,
            fuente_cantidad: "PLAN_CONFIRMADO_POR_PESAJE",
          },
          pesajes: [
            {
              estado: "vigente",
              peso_fisico_neto_kg: 12.5,
              peso_bruto_kg: 13.5,
              tara_kg: 1,
              kg_produccion_ot: 80,
              kg_fabricacion_estimado: 80,
              kg_entregado: 80,
              kg_verificados: 80,
              pesada_at: "2026-09-27T15:30:00Z",
              fecha_local_pesaje: "2026-09-27",
              pesado_por: "Ana",
              correcciones: [
                {
                  estado: "APLICADA",
                  motivo: "Corrección autorizada",
                  solicitada_at: "2026-09-27T16:30:00Z",
                  solicitada_por: { nombre: "Diego" },
                  resuelta_at: "2026-09-27T17:00:00Z",
                  resuelta_por: { nombre: "Elena" },
                  resultado: {
                    peso_fisico_neto_kg: 11.75,
                    tara_kg: 0.25,
                    referencia_interna: "no mostrar",
                  },
                },
              ],
              anulacion: {
                motivo: "Registro sustituido",
                anulada_at: "2026-09-27T18:00:00Z",
                anulada_por: { nombre: "Fabio" },
              },
            },
          ],
          controles_acumulados: [
            {
              tipo: "CONTROL",
              unidad: "KG",
              peso_neto_kg: 12.5,
              conteo_acumulado_un: 2,
              pesado_at: "2026-09-27T15:31:00Z",
            },
          ],
          cierres_control: [
            {
              tipo: "CIERRE_DESDE_CONTROL",
              peso_neto_kg: 12.5,
              cerrado_at: "2026-09-27T15:31:00Z",
              simula_pesaje: false,
            },
          ],
          reaperturas: [],
        },
        stock_movimientos: {
          estado: "disponible",
          items: [
            {
              unidad: "KG",
              cantidad_fisica_kg: 12.5,
              timestamp: "2026-09-27T16:10:00Z",
              actor: { nombre: "Carla" },
              ubicacion: { codigo: "ALM-1" },
            },
          ],
          movimientos: [
            {
              unidad: "KG",
              cantidad_delta: 12.5,
              saldo_fisico_resultante: 12.5,
              actor: { nombre: "Carla" },
            },
          ],
        },
        etiquetas: {
          estado: "restringido",
          motivo: "MANGA_PESAJE_VER requerido",
        },
        genealogia: {
          estado: "disponible",
          armado: {
            orden_ensamble: "ARM-1",
            articulo_salida: {
              codigo: "ART-SALIDA",
              nombre: "Producto armado",
            },
            origen: [
              {
                estado: "disponible",
                tipo: "CONSUMO",
                nivel: "RAIZ",
                manga_codigo: "KG-RAIZ",
                articulo: "ART-BASE",
                cantidad_incorporada_un: 2,
              },
            ],
          },
          items: [
            {
              codigo: "KG-1",
              raiz: { codigo: "KG-RAIZ" },
              padre: { codigo: "KG-PADRE" },
              division_id: "internal-division",
            },
          ],
        },
      },
      visibilidad: { pesaje: true },
    });

    render(
      <MangaHistoryDetailScm
        open
        onClose={vi.fn()}
        filters={filters}
        group={[{ dimension: "OF", value: "OF-1" }]}
      />,
    );
    expect(
      (await screen.findAllByText("Artículo de prueba")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Aporte en esta consulta")).toBeInTheDocument();
    expect(
      screen.getByText("Pendiente de recepción en almacén"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("12.50 kg").length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getAllByRole("button", {
        name: /Pesajes, correcciones y reaperturas/i,
      })[0],
    );
    expect(await screen.findByText("Controles acumulados")).toBeInTheDocument();
    expect(screen.getByText("Pesajes físicos")).toBeInTheDocument();
    expect(
      screen.getAllByText("12.50 kg", { exact: false }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Cierres desde control")).toBeInTheDocument();
    expect(screen.getAllByText("Peso bruto (kg)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Peso físico neto (kg)").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText("Tara (kg)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fecha local de pesaje").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("Fecha de control")).toBeInTheDocument();
    expect(screen.getAllByText("80.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("27/09/2026").length).toBeGreaterThan(0);
    expect(screen.getByText("Sin correcciones")).toBeInTheDocument();
    expect(screen.getByText(/Solicitada por:/)).toBeInTheDocument();
    expect(screen.getByText(/Corrección autorizada/)).toBeInTheDocument();
    expect(screen.getByText(/Solicitada por: Diego/)).toBeInTheDocument();
    expect(screen.getByText(/Resuelta por:/)).toBeInTheDocument();
    expect(screen.getByText(/Resuelta por: Elena/)).toBeInTheDocument();
    expect(screen.getByText(/Anulada por:/)).toBeInTheDocument();
    expect(screen.getByText(/Anulada por: Fabio/)).toBeInTheDocument();
    expect(screen.getByText("11.75")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Datos restringidos para el actor actual: Los pesos requieren/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        /peso_fisico_neto_kg|controles_acumulados|internal-uuid/i,
      ),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: /Documentos y continuidad/i })[0],
    );
    expect(screen.getAllByText(/27.*26/).length).toBeGreaterThan(0);
    expect(screen.getByText("Máquina")).toBeInTheDocument();
    expect(
      screen.getByText(/Plan confirmado por pesaje \(unidades de referencia/),
    ).toBeInTheDocument();
    expect(screen.getByText("Manga de origen")).toBeInTheDocument();
    expect(screen.getAllByText("KG-RAIZ").length).toBeGreaterThan(0);
    expect(screen.getByText("Producto armado")).toBeInTheDocument();
    expect(screen.getByText(/Unidad padre: KG-PADRE/)).toBeInTheDocument();
    expect(screen.getAllByText(/Responsable: Carla/).length).toBeGreaterThan(0);
    expect(screen.queryByText("internal-division")).not.toBeInTheDocument();
  });

  it("explicita lista vacía y reintento sin esconder un error recuperable", async () => {
    listarMangasHistoricoScm
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ items: [] });
    const onClose = vi.fn();
    render(
      <MangaHistoryDetailScm
        open
        onClose={onClose}
        filters={filters}
        group={[]}
      />,
    );
    expect(
      await screen.findByText("No se pudo cargar la lista de mangas."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByText("No hay mangas en esta agrupación."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("conserva el contexto aplicado de identidad mientras la lista falla", async () => {
    listarMangasHistoricoScm.mockRejectedValueOnce(new Error("network"));
    render(
      <MangaHistoryDetailScm
        open
        onClose={vi.fn()}
        filters={filters}
        group={[{ dimension: "MOLDE", value: "ML-1" }]}
        appliedContext={{
          group: [{ dimension: "MOLDE", value: "ML-1" }],
          groups: [
            { dimension: "MOLDE", value: "ML-1", nombre: "Molde azul", codigo: "ML-1" },
            { dimension: "PIEZA", value: "PZ-1", nombre: "Base", codigo: "PZ-1" },
            { dimension: "COLOR", value: "Rojo", nombre: "Rojo", codigo: null },
          ],
        }}
      />,
    );
    expect(screen.getByTestId("manga-applied-context")).toBeInTheDocument();
    expect(screen.getByText("Molde azul")).toBeInTheDocument();
    expect(screen.getByText("PZ-1")).toBeInTheDocument();
    expect(await screen.findByText("No se pudo cargar la lista de mangas.")).toBeInTheDocument();
    expect(screen.getByText("Molde azul")).toBeInTheDocument();
  });

  it("separa recepción original histórica de custodia vigente y remanente desconocido", async () => {
    listarMangasHistoricoScm.mockResolvedValue({
      items: [{
        id: "manga-custodia",
        codigo: "OF000900-OT001-M001",
        articulo: { nombre: "Colador n.º4" },
        aporte_consulta_kg: 11.9,
        tramos_consulta: 1,
      }],
    });
    obtenerDetalleMangaScm.mockResolvedValue({
      secciones: {
        identidad: {
          estado: "disponible",
          item: { codigo: "OF000900-OT001-M001", articulo: { nombre: "Colador n.º4" } },
        },
        stock_movimientos: {
          estado: "disponible",
          recepciones_historicas: [{
            unidad: "KG",
            cantidad_fisica_kg: 11.9,
            estado: "historica",
          }],
          custodia_vigente: [
            { unidad: "KG", cantidad_fisica_kg: 3.2, estado: "disponible" },
            { unidad: "KG", cantidad_fisica_kg: null, estado: "sin_datos", motivo: "remanente_sin_medicion" },
          ],
          items: [
            { unidad: "KG", cantidad_fisica_kg: 3.2, estado: "disponible" },
            { unidad: "KG", cantidad_fisica_kg: null, estado: "sin_datos", motivo: "remanente_sin_medicion" },
          ],
          movimientos: [],
        },
      },
    });
    render(
      <MangaHistoryDetailScm
        open
        onClose={vi.fn()}
        filters={filters}
        group={[]}
      />,
    );
    await screen.findAllByText("Colador n.º4");
    fireEvent.click(screen.getByRole("button", { name: /Custodia y movimientos/i }));
    expect(screen.getByText("Recepción original (histórica)")).toBeInTheDocument();
    expect(screen.getByText("Custodia vigente")).toBeInTheDocument();
    expect(screen.getByText("Remanente sin medición; no se infiere consumo ni saldo")).toBeInTheDocument();
  });

  it("une custodia proyectada KG con existencias UN legadas sin duplicar KG", async () => {
    listarMangasHistoricoScm.mockResolvedValue({
      items: [{
        id: "manga-mixta",
        codigo: "MIXTA-1",
        articulo: { nombre: "Manga mixta" },
        aporte_consulta_kg: 3.2,
        tramos_consulta: 1,
      }],
    });
    obtenerDetalleMangaScm.mockResolvedValue({
      secciones: {
        identidad: {
          estado: "disponible",
          item: { codigo: "MIXTA-1", articulo: { nombre: "Manga mixta" } },
        },
        stock_movimientos: {
          estado: "disponible",
          items: [
            { unidad: "UN", cantidad_fisica_un: 4, estado: "disponible" },
            { unidad: "KG", unidad_id: "kg-p1", cantidad_fisica_kg: 3.2, estado: "disponible" },
          ],
          custodia_vigente: [
            { unidad: "KG", unidad_id: "kg-p1", cantidad_fisica_kg: 3.2, estado: "disponible" },
          ],
          movimientos: [],
        },
      },
    });
    render(
      <MangaHistoryDetailScm
        open
        onClose={vi.fn()}
        filters={filters}
        group={[]}
      />,
    );
    await screen.findAllByText("Manga mixta");
    fireEvent.click(screen.getByRole("button", { name: /Custodia y movimientos/i }));
    expect(screen.getByText("UN")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getAllByText("3.20 kg")).toHaveLength(1);
  });

  it("muestra lista para grupos con varias identidades y abre sólo la seleccionada", async () => {
    listarMangasHistoricoScm.mockResolvedValue({
      items: [
        {
          id: "m-1",
          codigo: "M-001",
          color: "Rojo",
          articulo: { nombre: "Artículo uno" },
          aporte_consulta_kg: 1.2,
          tramos_consulta: 1,
        },
        {
          id: "m-2",
          codigo: "M-002",
          color: "Azul",
          articulo: { nombre: "Artículo dos" },
          aporte_consulta_kg: 2.3,
          tramos_consulta: 1,
        },
      ],
    });
    obtenerDetalleMangaScm.mockResolvedValue({
      as_of: "2026-09-28T15:00:00Z",
      secciones: {
        identidad: {
          estado: "disponible",
          item: { codigo: "M-002", articulo: { nombre: "Artículo dos" } },
        },
      },
    });
    render(
      <MangaHistoryDetailScm
        open
        onClose={vi.fn()}
        filters={filters}
        group={[{ dimension: "OF", value: "OF-1" }]}
      />,
    );
    expect(
      await screen.findByText("Mangas incluidas en esta agrupación"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Artículo dos"));
    expect(
      await screen.findByText("Aporte en esta consulta"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 tramo incluido")).toBeInTheDocument();
    expect(screen.queryByText("1 tramos incluidos")).not.toBeInTheDocument();
    expect(obtenerDetalleMangaScm).toHaveBeenCalledWith(
      "m-2",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(listarMangasHistoricoScm).toHaveBeenCalledWith(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
      [{ dimension: "OF", value: "OF-1" }],
    );
  });

  it("cierra y cancela cuando cambia actor o consulta mientras la ficha sigue abierta", async () => {
    let resolveList;
    listarMangasHistoricoScm.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    const onClose = vi.fn();
    const view = render(
      <MangaHistoryDetailScm
        open
        onClose={onClose}
        actorId={7}
        filters={filters}
        group={[]}
      />,
    );
    expect(listarMangasHistoricoScm).toHaveBeenCalledTimes(1);
    view.rerender(
      <MangaHistoryDetailScm
        open
        onClose={onClose}
        actorId={8}
        filters={{ ...filters, q: "otra consulta" }}
        group={[]}
      />,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    resolveList?.({ items: [{ id: "late", codigo: "respuesta vieja" }] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("respuesta vieja")).not.toBeInTheDocument();
  });

  it("recorre lista y ficha con foco determinista, y Escape solicita cierre", async () => {
    listarMangasHistoricoScm.mockResolvedValue({
      items: [
        {
          id: "m-focus",
          codigo: "M-FOCUS",
          color: "Rojo",
          articulo: { nombre: "Artículo foco" },
          aporte_consulta_kg: 1,
          tramos_consulta: 1,
        },
        {
          id: "m-other",
          codigo: "M-OTHER",
          color: "Azul",
          articulo: { nombre: "Artículo secundario" },
          aporte_consulta_kg: 2,
          tramos_consulta: 1,
        },
      ],
    });
    obtenerDetalleMangaScm.mockResolvedValue({
      secciones: {
        identidad: {
          estado: "disponible",
          item: { codigo: "M-FOCUS", articulo: { nombre: "Artículo foco" } },
        },
      },
    });
    const onClose = vi.fn();
    render(
      <MangaHistoryDetailScm
        open
        onClose={onClose}
        filters={filters}
        group={[{ dimension: "OF", value: "OF-1" }]}
      />,
    );
    const listItem = await screen.findByRole("button", {
      name: /Artículo foco/,
    });
    listItem.focus();
    fireEvent.click(listItem);
    expect(await screen.findByText("Detalle de manga")).toBeInTheDocument();
    await waitFor(() =>
      expect(document.activeElement).toHaveAttribute(
        "id",
        "manga-history-detail-title",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Volver a mangas" }));
    const restoredItem = await screen.findByRole("button", {
      name: /Artículo foco/,
    });
    await waitFor(() => expect(restoredItem).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
