# EnvaPeru Frontend

Este es el proyecto frontend del **Sistema Core de Producción, Pesaje e Inventario de EnvaPeru**. Desarrollado como una Single Page Application (SPA) con **React (Vite)** y **Material UI (MUI)**.

## Características

*   **Formularios Modulares**: Con autocompletado y cálculo interactivo de órdenes de producción (OP multi-pieza).
*   **Vistas e Índices**: Tablas y modales dinámicos para el seguimiento de la eficiencia y reportes de producción diaria.
*   **Diseño Responsivo**: Basado en Material UI para una experiencia de escritorio y tablets optimizada en planta.

## Requisitos de Entorno

*   Node.js (v18 o superior recomendado)
*   npm (v9 o superior)

## Instalación y Configuración

Instala las dependencias del proyecto ejecutando:

```bash
npm install
```

## Desarrollo

Para levantar el servidor de desarrollo local con recarga rápida (HMR):

```bash
npm run dev
```

El servidor proxy está preconfigurado en `vite.config.js` para redirigir las peticiones de `/api` al backend local en `http://localhost:5000`.

## Pruebas (Tests)

Las pruebas están configuradas con **Vitest** y **React Testing Library**:

```bash
npm run test
```

## Construcción para Producción

Para empaquetar la aplicación para despliegue:

```bash
npm run build
```

El resultado de la compilación se generará en la carpeta `dist/`.