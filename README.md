# CareBridge

Repositorio organizado segun la estructura definida para el proyecto.

## Estructura

- `Docs/`: documentacion general.
- `Docs/Base_Datos/`: esquema, migraciones y notas de base de datos.
- `Negocio/`: modelo de negocio y flujos de usuario.
- `Branding/`: moodboard, colores, tipografias y logo.
- `Frontend/`: todo el frontend exportado desde Figma.
- `Arquitectura/`: decisiones de stack y arquitectura tecnica.

## Frontend

El frontend actual esta dentro de `Frontend/` y conserva los archivos que entrego Figma:

- `Frontend/index.html`
- `Frontend/package.json`
- `Frontend/postcss.config.mjs`
- `Frontend/vite.config.ts`
- `Frontend/src/`
- `Frontend/guidelines/`
- `Frontend/ATTRIBUTIONS.md`
- `Frontend/README.md`

## Ejecutar en local

```bash
cd Frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```
