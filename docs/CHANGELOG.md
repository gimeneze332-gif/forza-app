# Historial de FORZA

Este changelog reconstruye la evolución comprobable del proyecto a partir del repositorio. Las fechas corresponden al historial Git local.

## Estado actual — FORZA 2.0

FORZA cuenta con un módulo Gym estable y funcional, acompañado por la primera versión mínima de Nutrition. Gym y Nutrition conservan persistencia, lógica y estilos separados. La aplicación sigue siendo una PWA Vanilla basada en LocalStorage y optimizada para móvil.

Último commit funcional estable: `e16b36e` — `feat: add minimal nutrition module and mobile polish`.

## 2026-08-07 — Nutrition: Sprint de Pulido

### `e16b36e` — `feat: add minimal nutrition module and mobile polish`

- Simplificación de la tarjeta Nutrition del dashboard.
- Panel inferior con apertura y cierre suaves.
- Safe areas, altura dinámica y mejoras para teclado móvil.
- Botones táctiles, foco visible y movimiento reducido.
- Confirmaciones temporales accesibles.
- Restauración de foco y frecuentes en un toque.
- Validación móvil en 390 × 844.

## 2026-08-07 — Creación de Nutrition

### `c6e7776` — `Add minimal Nutrition companion module`

- Incorporación aditiva de Nutrition dentro de Inicio.
- Nuevos archivos `nutrition.js`, `nutrition.css` y `tests/nutrition.test.cjs`.
- Objetivos de calorías, proteína y agua.
- Registro por texto con catálogo local y revisión manual.
- Macronutrientes opcionales, agua y comidas frecuentes.
- Claves LocalStorage exclusivas.
- Integración PWA de los recursos Nutrition.
- Carga posterior a Gym y contención de errores de inicialización.

## 2026-08-07 — Evolución y estabilización de Gym

### `9314e0b` — `Add backup safety controls for FORZA v6.5`

- Estado visible del último backup.
- Aviso de cambios sin respaldar.
- Vista previa antes de restaurar.
- Recuperación de datos anteriores ante fallos de restauración.

### `7d21625` — `Add retroactive achievements for FORZA v6.4`

- Sistema de logros calculados desde el historial existente.
- Resumen y progreso de logros.

### `250c45c` — `Redesign dashboard for FORZA v6.3`

- Reorganización del dashboard.
- Métricas semanales y mensuales.
- Actividad reciente, último PR y próximo objetivo.

### `768999b` — `Add exercise progress analytics for FORZA v6.2`

- Progreso por ejercicio.
- Métricas de peso, volumen y 1RM estimado.
- Normalización de nombres y mejoras del gráfico.

### `3df6991` — `Add workout calendar for FORZA v6.1`

- Calendario mensual.
- Detalle diario construido desde el historial Gym existente.

### `1b80dcc` — `Release FORZA v6.0 stability baseline`

- Base de estabilidad y persistencia.
- Limpieza del código principal.
- PWA y manifiesto ajustados.
- Incorporación de pruebas smoke para Gym.
- Hoja de ruta inicial de estabilización.

## 2026-06-10 — Nacimiento de FORZA

### `343264c` — `Initial commit`

- Creación inicial del repositorio.

### `6c5e35d` — `Add files via upload`

- Incorporación de los archivos base de la aplicación de seguimiento de gimnasio.

## Estado de compatibilidad

- Gym mantiene sus flujos de rutinas, entrenamientos, historial, calendario, estadísticas, PR, logros y backup.
- Nutrition es un complemento independiente y no escribe claves Gym.
- No existe backend, cuenta, sincronización, IA real ni procesamiento de fotografías.
- Las capacidades futuras se mantienen como planificación en `docs/ROADMAP.md`.
