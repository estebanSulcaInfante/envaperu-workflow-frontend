import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
  useNavigate,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductionOrderProgressScm from "../components/ProductionOrderProgressScm";
import ProductionHistoryScm from "../components/ProductionHistoryScm";
import {
  exportarProduccionHistoricaScm,
  listarAvanceOfScm,
  listarMangasHistoricoScm,
  listarProduccionHistoricaScm,
} from "../services/scmProductionObservabilityApi";

vi.mock("../services/scmProductionObservabilityApi", () => ({
  listarAvanceOfScm: vi.fn(),
  listarMangasHistoricoScm: vi.fn(),
  listarProduccionHistoricaScm: vi.fn(),
  exportarProduccionHistoricaScm: vi.fn(),
}));
vi.mock("../context/ScmActorContext", () => ({
  useScmActor: () => ({ actorId: actorState.id, can: () => true }),
}));

const actorState = vi.hoisted(() => ({ id: 1 }));

const renderInRouter = (element, initialEntries = ["/"]) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>{element}</MemoryRouter>,
  );
const HistoryHarness = () => {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>
        URL anterior
      </button>
      <ProductionHistoryScm />
    </>
  );
};

describe("reportes de control de producción", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actorState.id = 1;
  });
  it("muestra avance jerárquico y cobertura sin criterio parejo", async () => {
    listarAvanceOfScm.mockResolvedValue({
      items: [
        {
          corrida_id: "r1",
          of: "OF-1",
          corrida: "C-1",
          color: "Rojo",
          objetivo_neto_kg: 10,
          kg_finalizados_efectivos: 4,
          porcentaje: 40,
          coverage: { estado: "COMPLETA" },
          mangas: { total: 1, conocidas: 1 },
          criterio_uniformidad: "Criterio de uniformidad no definido",
        },
      ],
    });
    renderInRouter(<ProductionOrderProgressScm />);
    expect(await screen.findByText("Avance de OF")).toBeInTheDocument();
    expect(await screen.findByText("OF-1")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Objetivo de color" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Corrida")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expandir OF-1" }));
    expect(
      screen.getByText("Criterio de uniformidad no definido"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/parejo/i)).not.toBeInTheDocument();
  });

  it("expone histórico con rango, medidas y estado vacío recuperable", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({ items: [] });
    renderInRouter(<ProductionHistoryScm />);
    expect(
      await screen.findByText("Histórico de producción"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText("No hay producción en el rango seleccionado."),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Exportar")).toBeInTheDocument();
    expect(screen.getByLabelText("Desde")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
    expect(await screen.findByText("Objetivo de color")).toBeInTheDocument();
    expect(screen.queryByText("CORRIDA")).not.toBeInTheDocument();
  });

  it("aplica una agrupación en bloque y consulta una sola vez al buscar", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({ items: [] });
    renderInRouter(<ProductionHistoryScm />);
    await screen.findByText("Histórico de producción");
    await waitFor(() =>
      expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
    fireEvent.click(await screen.findByText("Objetivo de color"));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() =>
      expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(2),
    );
    expect(listarProduccionHistoricaScm).toHaveBeenLastCalledWith(
      expect.objectContaining({ agrupaciones: ["DIA", "CORRIDA"] }),
    );
  });

  it("mantiene la carga inicial bajo StrictMode y no deja un request abortado", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({ items: [] });
    render(
      <StrictMode>
        <MemoryRouter>
          <ProductionHistoryScm />
        </MemoryRouter>
      </StrictMode>,
    );
    await waitFor(() =>
      expect(listarProduccionHistoricaScm).toHaveBeenCalled(),
    );
    expect(
      await screen.findByText("No hay producción en el rango seleccionado."),
    ).toBeInTheDocument();
  });

  it("invalida filas y respuestas tardías al cambiar de actor", async () => {
    let resolveFirst;
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    listarProduccionHistoricaScm
      .mockImplementationOnce(() => firstResponse)
      .mockResolvedValueOnce({ items: [], visibilidad: { pesaje: false } });
    const view = renderInRouter(<ProductionHistoryScm />);
    await screen.findByText("Histórico de producción");
    actorState.id = 2;
    view.rerender(
      <MemoryRouter initialEntries={["/"]}>
        <ProductionHistoryScm />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(2),
    );
    expect(screen.queryByText("old-actor-row")).not.toBeInTheDocument();
    resolveFirst({
      items: [
        {
          DIA: "old-actor-row",
          PESO_KG: 1,
          SUBTOTAL_CONOCIDO_KG: 1,
          coverage: "COMPLETA",
        },
      ],
      visibilidad: { pesaje: true },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("old-actor-row")).not.toBeInTheDocument();
  });

  it("cierra el selector con Escape conservando la selección inmediata sin consultar", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({ items: [] });
    renderInRouter(<ProductionHistoryScm />);
    await screen.findByText("Histórico de producción");
    await waitFor(() =>
      expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
    fireEvent.click(await screen.findByText("Objetivo de color"));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() =>
      expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(2),
    );
    expect(listarProduccionHistoricaScm).toHaveBeenLastCalledWith(
      expect.objectContaining({ agrupaciones: ["DIA", "CORRIDA"] }),
    );
  });

  it("no consulta con medidas vacías y mantiene el error accionable", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({ items: [] });
    renderInRouter(<ProductionHistoryScm />);
    await screen.findByText("Histórico de producción");
    await waitFor(() =>
      expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(screen.getByRole("button", { name: "Medidas" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Limpiar visibles" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getAllByRole("alert")
        .find((alert) =>
          alert.textContent.includes("Selecciona al menos una medida"),
        ),
    ).toBeTruthy();
  });

  it("conserva la selección fuera de las opciones visibles", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({ items: [] });
    renderInRouter(<ProductionHistoryScm />);
    await screen.findByText("Histórico de producción");
    await waitFor(() =>
      expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
    fireEvent.click(await screen.findByText("Objetivo de color"));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
    const search = screen.getByRole("textbox", {
      name: "Buscar opciones de Agrupar",
    });
    fireEvent.change(search, { target: { value: "día" } });
    fireEvent.click(screen.getByRole("button", { name: "Limpiar visibles" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() =>
      expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(2),
    );
    expect(listarProduccionHistoricaScm).toHaveBeenLastCalledWith(
      expect.objectContaining({ agrupaciones: ["CORRIDA"] }),
    );
  });

  it("distingue búsqueda sin resultados del rango vacío y permite limpiar sólo q", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({ items: [] });
    renderInRouter(<ProductionHistoryScm />, [
      "/control/historico-produccion?q=sin-coincidencia",
    ]);
    expect(
      await screen.findByText("No hay resultados para “sin-coincidencia”."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(screen.getByDisplayValue("")).toBeInTheDocument();
    expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1);
  });

  it("rechaza tokens vacíos de URL sin convertirlos silenciosamente en total válido", async () => {
    renderInRouter(<ProductionHistoryScm />, [
      "/control/historico-produccion?agrupaciones=ARTICULO,,DIA&medidas=MANGAS",
    ]);
    expect(
      await screen.findByText(
        "La selección de agrupaciones contiene una opción vacía.",
      ),
    ).toBeInTheDocument();
    expect(listarProduccionHistoricaScm).not.toHaveBeenCalled();
  });

  it("restaura una URL anterior con una sola consulta al navegar atrás", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({ items: [] });
    const router = createMemoryRouter(
      [{ path: "*", element: <HistoryHarness /> }],
      {
        initialEntries: [
          "/control/historico-produccion?q=anterior",
          "/control/historico-produccion?q=actual",
        ],
        initialIndex: 1,
      },
    );
    render(<RouterProvider router={router} />);
    await screen.findByText(/Consulta aplicada:/);
    await waitFor(() =>
      expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(screen.getByRole("button", { name: "URL anterior" }));
    await waitFor(() =>
      expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(2),
    );
    expect(listarProduccionHistoricaScm).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "anterior" }),
    );
  });

  it("reintenta sólo la exportación cuando falla", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({
      items: [
        {
          DIA: "2026-09-01",
          PESO_KG: 1,
          SUBTOTAL_CONOCIDO_KG: 1,
          coverage: "COMPLETA",
        },
      ],
      visibilidad: { pesaje: true },
    });
    exportarProduccionHistoricaScm.mockRejectedValue(
      new Error("fallo exportación"),
    );
    renderInRouter(<ProductionHistoryScm />);
    await screen.findByText(/Consulta aplicada:/);
    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
    expect(
      await screen.findByText("No se pudo exportar el histórico."),
    ).toBeInTheDocument();
    expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1);
    expect(exportarProduccionHistoricaScm).toHaveBeenCalledTimes(1);
  });

  it("descarta una exportación tardía si cambia el actor", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({
      items: [
        {
          DIA: "2026-09-01",
          PESO_KG: 1,
          SUBTOTAL_CONOCIDO_KG: 1,
          coverage: "COMPLETA",
        },
      ],
      visibilidad: { pesaje: true },
    });
    let resolveExport;
    exportarProduccionHistoricaScm.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveExport = resolve;
        }),
    );
    const view = renderInRouter(<ProductionHistoryScm />);
    await screen.findByText(/Consulta aplicada:/);
    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
    actorState.id = 2;
    view.rerender(
      <MemoryRouter initialEntries={["/"]}>
        <ProductionHistoryScm />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(2),
    );
    resolveExport({ data: new Blob(["xlsx"]) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      screen.queryByText("Exportación iniciada para la consulta aplicada."),
    ).not.toBeInTheDocument();
  });

  it("muestra el nombre del artículo como identificación principal y el código como referencia", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({
      items: [
        {
          ARTICULO: "PC-000153",
          ARTICULO_CODIGO: "PC-000153",
          ARTICULO_NOMBRE: "COLADOR #4 CREMA SÓLIDO",
          PESO_KG: 39.5,
          MANGAS: 2,
          P_UNITARIO_G: null,
          P_TEORICO_KG: null,
          SUBTOTAL_CONOCIDO_KG: 39.5,
          coverage: "COMPLETA",
        },
      ],
      visibilidad: { pesaje: true },
    });
    renderInRouter(<ProductionHistoryScm />, [
      "/control/historico-produccion?desde=2026-09-01&hasta=2026-09-23&agrupaciones=ARTICULO",
    ]);
    expect(
      await screen.findByText("COLADOR #4 CREMA SÓLIDO"),
    ).toBeInTheDocument();
    expect(screen.getByText("PC-000153")).toBeInTheDocument();
    expect(
      screen
        .getByText("COLADOR #4 CREMA SÓLIDO")
        .compareDocumentPosition(screen.getByText("PC-000153")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renderiza la jerarquía del servidor, permite contraer por nivel y alterna a plana sin red", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({
      items: [
        {
          OF: "OF-1",
          ARTICULO: "PC-1",
          ARTICULO_NOMBRE: "Artículo 1",
          PESO_KG: 12,
          MANGAS: 2,
        },
      ],
      jerarquia: [
        {
          id: "OF=OF-1",
          dimension: "OF",
          value: "OF-1",
          item: {
            OF: "OF-1",
            PESO_KG: 12,
            MANGAS: 2,
            SUBTOTAL_CONOCIDO_KG: 12,
            coverage: "COMPLETA",
          },
          children: [
            {
              id: "OF=OF-1|ARTICULO=PC-1",
              dimension: "ARTICULO",
              value: "PC-1",
              item: {
                OF: "OF-1",
                ARTICULO: "PC-1",
                ARTICULO_NOMBRE: "Artículo 1",
                PESO_KG: 12,
                MANGAS: 2,
                SUBTOTAL_CONOCIDO_KG: 12,
                coverage: "COMPLETA",
              },
              children: [],
            },
          ],
        },
      ],
      resumen: {
        PESO_KG: 12,
        MANGAS: 2,
        SUBTOTAL_CONOCIDO_KG: 12,
        coverage: "COMPLETA",
      },
      visibilidad: { pesaje: true },
    });
    renderInRouter(<ProductionHistoryScm />, [
      "/control/historico-produccion?agrupaciones=OF,ARTICULO&medidas=PESO_KG,MANGAS",
    ]);
    expect(await screen.findByText("Artículo 1")).toBeInTheDocument();
    expect(screen.getByText("Total general")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Contraer OF-1" }));
    expect(
      screen.queryByRole("button", { name: /Expandir Artículo 1/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expandir OF-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Vista plana" }));
    expect(
      screen.queryByRole("button", { name: "Contraer OF-1" }),
    ).not.toBeInTheDocument();
    expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1);
  });

  it("aplica agrupación y medidas al formulario de inmediato, pero consulta sólo con Buscar", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({ items: [] });
    renderInRouter(<ProductionHistoryScm />);
    await waitFor(() =>
      expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
    fireEvent.click(await screen.findByText("Objetivo de color"));
    expect(
      screen.queryByRole("button", { name: "Aplicar selección" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/Agrupar: Objetivo de color/)).toBeInTheDocument();
    expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() =>
      expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(2),
    );
    expect(listarProduccionHistoricaScm).toHaveBeenLastCalledWith(
      expect.objectContaining({ agrupaciones: ["DIA", "CORRIDA"] }),
    );
  });

  it("cambia columnas de presentación sin consultar y explica cobertura como integridad de atribución", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({
      items: [
        {
          DIA: "2026-09-01",
          ARTICULO: "PC-1",
          ARTICULO_CODIGO: "PC-1",
          ARTICULO_NOMBRE: "Artículo 1",
          PESO_KG: 1,
          SUBTOTAL_CONOCIDO_KG: 1,
          coverage: "COMPLETA",
        },
      ],
      resumen: { PESO_KG: 1, SUBTOTAL_CONOCIDO_KG: 1, coverage: "COMPLETA" },
      visibilidad: { pesaje: true },
    });
    renderInRouter(<ProductionHistoryScm />, [
      "/control/historico-produccion?agrupaciones=ARTICULO",
    ]);
    await screen.findByText("Artículo 1");
    await waitFor(() =>
      expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1),
    );
    expect(screen.getAllByText("PC-1").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Columnas" }));
    fireEvent.click(screen.getByLabelText("Códigos"));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByText("PC-1")).not.toBeInTheDocument();
    expect(
      screen.getAllByTitle(/integridad de atribución/i).length,
    ).toBeGreaterThan(0);
    expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1);
  });

  it("ofrece fallback plano explícito cuando el servidor no entrega jerarquía", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({
      items: [
        {
          DIA: "2026-09-01",
          PESO_KG: 3,
          SUBTOTAL_CONOCIDO_KG: 3,
          coverage: "COMPLETA",
        },
      ],
      resumen: { PESO_KG: 3, SUBTOTAL_CONOCIDO_KG: 3, coverage: "COMPLETA" },
      visibilidad: { pesaje: true },
    });
    renderInRouter(<ProductionHistoryScm />);
    expect(
      await screen.findByText(/Vista agrupada no disponible/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("cell").some((cell) => /3/.test(cell.textContent)),
    ).toBe(true);
  });

  it("muestra el total de mangas sin inventar una columna de código cuando no hay agrupaciones", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({
      items: [{ MANGAS: 7, coverage: "COMPLETA" }],
      resumen: { MANGAS: 7, coverage: "COMPLETA" },
      visibilidad: { pesaje: true },
    });
    renderInRouter(<ProductionHistoryScm />, [
      "/control/historico-produccion?agrupaciones=&medidas=MANGAS",
    ]);
    expect(await screen.findByText("Total general")).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Código artículo" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "7" })).toBeInTheDocument();
  });

  it("abre el total general desde la vista plana sin enviar una agrupación ficticia", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({
      items: [{ OF: "OF-1", MANGAS: 7, coverage: "COMPLETA" }],
      resumen: { MANGAS: 7, coverage: "COMPLETA" },
      visibilidad: { pesaje: true },
    });
    listarMangasHistoricoScm.mockResolvedValue({ items: [], total: 0 });
    renderInRouter(<ProductionHistoryScm />, [
      "/control/historico-produccion?agrupaciones=OF&medidas=MANGAS",
    ]);
    expect(await screen.findByText("Total general")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Vista plana" }));
    fireEvent.click(
      screen.getByRole("button", { name: "7 mangas del grupo total general" }),
    );
    await waitFor(() =>
      expect(listarMangasHistoricoScm).toHaveBeenCalledWith(
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
        [],
      ),
    );
  });

  it("abre el total general desde la vista agrupada con el mismo grupo vacío", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({
      items: [{ OF: "OF-1", MANGAS: 7, coverage: "COMPLETA" }],
      jerarquia: [
        {
          id: "OF=OF-1",
          dimension: "OF",
          value: "OF-1",
          item: { OF: "OF-1", MANGAS: 7, coverage: "COMPLETA" },
          children: [],
        },
      ],
      resumen: { MANGAS: 7, coverage: "COMPLETA" },
      visibilidad: { pesaje: true },
    });
    listarMangasHistoricoScm.mockResolvedValue({ items: [], total: 0 });
    renderInRouter(<ProductionHistoryScm />, [
      "/control/historico-produccion?agrupaciones=OF&medidas=MANGAS",
    ]);
    expect(await screen.findByText("Total general")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "7 mangas del grupo total general" }),
    );
    await waitFor(() =>
      expect(listarMangasHistoricoScm).toHaveBeenCalledWith(
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
        [],
      ),
    );
  });

  it("no añade columna de código para una agrupación por día sin artículo", async () => {
    listarProduccionHistoricaScm.mockResolvedValue({
      items: [{ DIA: "2026-09-01", MANGAS: 7, coverage: "COMPLETA" }],
      resumen: { MANGAS: 7, coverage: "COMPLETA" },
      visibilidad: { pesaje: true },
    });
    renderInRouter(<ProductionHistoryScm />, [
      "/control/historico-produccion?agrupaciones=DIA&medidas=MANGAS",
    ]);
    expect(await screen.findByText("2026-09-01")).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Código artículo" }),
    ).not.toBeInTheDocument();
  });

  it("lee q de la URL para solicitar avance al servidor", async () => {
    listarAvanceOfScm.mockResolvedValue({ items: [] });
    renderInRouter(<ProductionOrderProgressScm />, [
      "/control/avance-of?q=OF-URL",
    ]);
    await screen.findByText("Avance de OF");
    await waitFor(() =>
      expect(listarAvanceOfScm).toHaveBeenCalledWith({ q: "OF-URL" }),
    );
  });
});
