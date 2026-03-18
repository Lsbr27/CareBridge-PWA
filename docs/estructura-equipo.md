# Estructura del Proyecto CareBridge-PWA

Esta es la estructura de carpetas organizada para el desarrollo de la app. Cada carpeta tiene un propósito específico para mantener el código limpio y colaborativo.

## 📁 Estructura General

```
CareBridge-PWA/
├── public/                # Archivos accesibles directamente (logo, favicon, etc.)
│   ├── logos/
│   ├── icons/
│   └── images/
│
├── src/
│   ├── features/          # Aquí construyen TODA la app (pantallas y funcionalidades)
│   ├── components/        # Botones, inputs, cards reutilizables
│   ├── services/          # Conexión con API, auth, almacenamiento
│   ├── hooks/             # Lógica reutilizable (React)
│   ├── utils/             # Funciones auxiliares
│   ├── types/             # Estructura de datos (si usan TypeScript)
│   ├── styles/            # Colores, tipografía, estilos globales
│   └── assets/            # Imágenes, íconos, videos usados dentro del código
│       ├── images/
│       ├── icons/
│       └── videos/
│
├── design/                # TODO lo visual (no código)
│   ├── figma/
│   ├── wireframes/
│   └── user-flows/
```

## 📂 Descripción Detallada de Carpetas

Aquí explico qué va en cada carpeta, con ejemplos para que sepan dónde poner sus archivos. Esto ayuda a mantener todo organizado y fácil de encontrar.

### 📁 `public/`
Archivos que el navegador puede acceder directamente (sin pasar por el código de la app). Son estáticos y públicos.
- **`logos/`**: Logos de la app o empresa (ej: `carebridge-logo.png`).
- **`icons/`**: Íconos generales (ej: `favicon.ico`, íconos para PWA).
- **`images/`**: Imágenes públicas (ej: banners, fondos que no cambian).

**Ejemplo**: Si subes un logo a GitHub, ponlo aquí para que aparezca en la web.

### 📁 `src/`
Todo el código fuente de la aplicación React (o framework que usen).

- **`features/`**: Las pantallas y funcionalidades principales de la app. Aquí construyen TODO lo que ve el usuario.
  - Ej: `Login/`, `DashboardPaciente/`, `RegistroSintomas/`.
  - Dentro de cada feature: componentes, lógica, estilos específicos de esa pantalla.

- **`components/`**: Componentes reutilizables que usan en varias partes de la app.
  - Ej: `Button.jsx`, `InputField.jsx`, `CardPaciente.jsx`.
  - No pantallas completas, sino piezas pequeñas como botones o formularios.

- **`services/`**: Lógica para conectar con el exterior (APIs, bases de datos, autenticación).
  - Ej: `api.js` (funciones para llamar a la API), `auth.js` (login/logout), `storage.js` (guardar datos localmente).

- **`hooks/`**: Lógica reutilizable en React (custom hooks).
  - Ej: `useAuth.js` (manejar estado de login), `useForm.js` (validar formularios).

- **`utils/`**: Funciones auxiliares que no son específicas de React.
  - Ej: `formatDate.js` (formatear fechas), `validateEmail.js` (validar correos).

- **`types/`**: Definiciones de tipos de datos (si usan TypeScript).
  - Ej: `User.ts`, `Appointment.ts` (estructuras de objetos).

- **`styles/`**: Estilos globales, colores, tipografía.
  - Ej: `colors.js` (paleta de colores), `global.css` (estilos base), `theme.js` (tema oscuro/claro).

- **`assets/`**: Archivos multimedia usados dentro del código (no públicos).
  - **`images/`**: Fotos o ilustraciones importadas en componentes (ej: íconos de síntomas).
  - **`icons/`**: Íconos SVG o PNG usados en botones (ej: `heart-icon.svg`).
  - **`videos/`**: Videos cortos para tutoriales o animaciones.

### 📁 `design/`
Archivos visuales y de diseño, NO código. Para compartir ideas y prototipos.
- **`figma/`**: Archivos de Figma o enlaces a diseños (ej: `app-design.fig`).
- **`wireframes/`**: Bocetos simples en papel o digital (ej: `wireframe-login.jpg`).
- **`user-flows/`**: Diagramas de cómo fluye el usuario por la app (ej: `flujo-registro.png`).

**Nota**: Esta carpeta no se sube a producción; es solo para desarrollo.

## 👥 Cómo Trabajar en Equipo (Principiantes)

### 1. **Usar Branches en Git**
- **Nunca trabajen directamente en `main`** (rama principal). Es como la "versión final" del proyecto.
- Cada persona crea su propia rama para trabajar:
  - Laura: `branch/laura`
  - Tania: `branch/tania`
  - Valentina: `branch/valentina`
- **Cómo crear y usar una rama:**
  ```bash
  git checkout -b branch/tu-nombre  # Crea y cambia a tu rama
  # Trabaja aquí...
  git add .
  git commit -m "Descripción clara de lo que hiciste"
  git push origin branch/tu-nombre  # Sube tu rama a GitHub
  ```

### 2. **Evitar Conflictos y Borrados**
- **Siempre haz `git pull origin main`** antes de empezar a trabajar (para tener lo último).
- **No edites el mismo archivo al mismo tiempo**. Si necesitas algo de otro, pídelo por chat.
- **Commits frecuentes**: No esperes a terminar todo; guarda avances con mensajes como "Agregué botón de login" o "Arreglé error en formulario".
- Si hay conflicto al hacer merge, avísanos y resolvemos juntos.

### 3. **Revisión de Cambios (Pull Requests)**
- Cuando termines una tarea, crea un **Pull Request** en GitHub para que las otras revisen tu código.
- Las otras aprueban o comentan antes de unir a `main`.
- Esto evita que algo se rompa o se borre accidentalmente.

### 4. **Asignación de Tareas (Sugerencia)**
Para empezar, dividan responsabilidades claras:
- **Laura**: Lidera `features/` (pantallas principales como login, dashboard paciente/médico).
- **Tania**: Lidera `components/` (crea botones, inputs, cards que todos usen).
- **Valentina**: Lidera `services/` y `utils/` (conexión con API, funciones auxiliares).
- **Compartido**: `styles/`, `assets/`, `design/` (todos pueden contribuir).

### 5. **Comunicación**
- Usen WhatsApp/Telegram para coordinar: "¿Qué vas a trabajar hoy?" o "Necesito este componente".
- Si algo no funciona, pregunten sin miedo. Somos principiantes, ¡eso es normal!
- Reunión semanal: Revisen avances y ajusten planes.

### 6. **Reglas Básicas**
- **No borres archivos de otros** sin preguntar.
- **Documenta tu código**: Agrega comentarios en funciones nuevas.
- **Prueba tu código** antes de subir: ¿Funciona sin errores?
- Si usas VS Code, instala extensiones como GitLens para ver cambios fácilmente.

### 7. **Próximos Pasos**
- Crea un issue en GitHub para cada tarea grande (ej: "Crear pantalla de login").
- Empiecen con algo simple: Un componente básico en `components/`.
- Si necesitan ayuda con Git, digan y explico paso a paso.

¡Esta estructura y flujo harán que el proyecto sea organizado y divertido! Si tienen dudas, pregunten.