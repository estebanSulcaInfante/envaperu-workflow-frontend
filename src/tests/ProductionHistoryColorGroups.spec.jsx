import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductionHistoryScm from "../components/ProductionHistoryScm";
import { listarProduccionHistoricaScm, listarMangasHistoricoScm } from "../services/scmProductionObservabilityApi";

vi.mock("../services/scmProductionObservabilityApi", () => ({
  listarProduccionHistoricaScm: vi.fn(), listarMangasHistoricoScm: vi.fn(),
  exportarProduccionHistoricaScm: vi.fn(),
}));
vi.mock("../context/ScmActorContext", () => ({
  useScmActor: () => ({ actorId: 1, can: () => true }),
}));

const item = {
  MOLDE: "ML-000001", MOLDE_NOMBRE: "Molde de jarra", MOLDE_CODIGO: "ML-000001",
  PIEZA: "PZ-000001", PIEZA_NOMBRE: "Pico de jarra", PIEZA_CODIGO: "PZ-000001",
  COLOR: "Azul", COLOR_HEX: "#1565C0", PESO_KG: 15.6, MANGAS: 2, coverage: "COMPLETA",
};
function report(groups) {
  const node = (index, path = []) => {
    const dimension = groups[index];
    const next = [...path, { dimension, value: item[dimension] }];
    return { id: JSON.stringify(next), dimension, value: item[dimension], item,
      children: index + 1 < groups.length ? [node(index + 1, next)] : [] };
  };
  return { items: [item], jerarquia: [node(0)], resumen: item, visibilidad: { pesaje: true } };
}
function open(groups) {
  const router = createMemoryRouter([{ path: "*", element: <ProductionHistoryScm /> }], {
    initialEntries: [`/control/historico-produccion?desde=2026-09-01&hasta=2026-09-29&agrupaciones=${groups}&medidas=PESO_KG,MANGAS`],
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe("comparación de colores por molde y pieza", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listarProduccionHistoricaScm.mockImplementation(async ({ agrupaciones }) => report(agrupaciones));
    listarMangasHistoricoScm.mockResolvedValue({ items: [], total: 0 });
  });

  it("reordena niveles sin consultar hasta Buscar y conserva la ruta canónica de mangas", async () => {
    const router = open("MOLDE,PIEZA,COLOR");
    expect(await screen.findByText("Molde de jarra")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Subir nivel Pieza base" }));
    expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1);
    expect(new URLSearchParams(router.state.location.search).get("agrupaciones")).toBe("MOLDE,PIEZA,COLOR");
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(2));
    expect(listarProduccionHistoricaScm).toHaveBeenLastCalledWith(expect.objectContaining({ agrupaciones: ["PIEZA", "MOLDE", "COLOR"] }));
    expect(new URLSearchParams(router.state.location.search).get("agrupaciones")).toBe("PIEZA,MOLDE,COLOR");
    expect(await screen.findByText("Pico de jarra")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /2 mangas del grupo Pieza base/ }));
    await waitFor(() => expect(listarMangasHistoricoScm).toHaveBeenCalledWith(
      expect.objectContaining({ agrupaciones: ["PIEZA", "MOLDE", "COLOR"] }),
      [{ dimension: "PIEZA", value: "PZ-000001" }],
    ));
    const context = within(screen.getByTestId("manga-applied-context"));
    expect(context.getByText("Pico de jarra")).toBeInTheDocument();
    expect(context.queryByText("Color", { exact: true })).not.toBeInTheDocument();
    expect(context.queryByText("Molde", { exact: true })).not.toBeInTheDocument();
  });

  it("respeta el orden guardado y muestra nombres en la tabla plana sin otra consulta", async () => {
    open("COLOR,PIEZA,MOLDE");
    await screen.findByText("Azul");
    expect(screen.getByTitle("Muestra de referencia: #1565C0")).toBeInTheDocument();
    expect(listarProduccionHistoricaScm).toHaveBeenLastCalledWith(expect.objectContaining({ agrupaciones: ["COLOR", "PIEZA", "MOLDE"] }));
    fireEvent.click(screen.getByRole("button", { name: "Vista plana" }));
    expect(screen.getAllByRole("columnheader").slice(0, 3).map((cell) => cell.textContent)).toEqual(["Color", "Pieza base", "Molde"]);
    expect(screen.getByText("Pico de jarra")).toBeInTheDocument();
    expect(screen.getByText("Molde de jarra")).toBeInTheDocument();
    expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1);
  });

  it("conserva el foco al mover un nivel intermedio para continuar con teclado", async () => {
    open("MOLDE,PIEZA,COLOR");
    await screen.findByText("Molde de jarra");
    const control = screen.getByRole("button", { name: "Subir nivel Color" });
    control.focus();
    fireEvent.click(control);
    expect(screen.getByRole("button", { name: "Subir nivel Color" })).toHaveFocus();
    expect(listarProduccionHistoricaScm).toHaveBeenCalledTimes(1);
  });
});
