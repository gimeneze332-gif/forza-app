# Roadmap oficial de FORZA

Este documento separa el producto implementado de la planificación futura. Una entrada en el roadmap no autoriza su desarrollo: cada Sprint requiere diseño, análisis de impacto y aprobación.

## Versión actual

### v2.0 — Base estable — Implementado

#### Gym — Implementado

- Rutinas personalizadas de cuatro días.
- Registro, edición y eliminación de entrenamientos.
- Dashboard, historial y filtros.
- Calendario mensual.
- Estadísticas por ejercicio, volumen y 1RM estimado.
- Récords personales y logros.
- Seguimiento corporal y objetivo de peso existentes.
- Temporizador, modo oscuro y diseño responsive.
- Exportación CSV.
- Backup y restauración JSON con controles de seguridad.
- PWA instalable y soporte offline de recursos locales.

#### Nutrition básico — Implementado

- Tarjeta compacta en Inicio.
- Objetivos y totales diarios de calorías, proteína y agua.
- Registro por texto con catálogo local y revisión manual.
- Carbohidratos y grasas opcionales en el modelo.
- Agua +250 ml.
- Comidas frecuentes en un toque.
- Panel inferior pulido para iPhone y feedback accesible.
- Persistencia separada de Gym.

## Versiones futuras

### v2.1 — Smart Text y mejoras UX — Planeada

- Smart Text para interpretación más flexible del registro escrito.
- Catálogo local ampliado y confianza por componente.
- Reconocimiento de cantidades y preparaciones frecuentes.
- Meals: comidas completas reutilizables detectables por nombre.
- Memoria contextual local:
  - “Lo de ayer”.
  - “Lo de siempre”.
  - “Mi desayuno”.
  - “Mi merienda”.
  - “Mi post entreno”.
- Favoritos inteligentes organizados como:
  - recientes;
  - favoritas;
  - habituales;
  - por horario.
- Memoria local de correcciones, alias y porciones confirmadas.
- Mejoras UX derivadas de uso real y validación móvil.

Condiciones:

- conservar el texto original;
- permitir corrección antes de guardar;
- evitar valores inventados cuando la confianza sea insuficiente;
- funcionar completamente offline, sin IA externa ni APIs;
- solicitar siempre confirmación para referencias contextuales;
- tratar Meals como plantillas y no como registros diarios;
- calcular recientes, habituales y horario sin duplicar fuentes de datos;
- mantener el registro manual disponible;
- no modificar ni depender de Gym.

Estado interno de v2.1:

- diseño técnico general: aprobado;
- Meals: diseño incorporado;
- memoria contextual: diseño incorporado;
- favoritos inteligentes: diseño incorporado;
- implementación: no iniciada.

### v2.2 — Fotografía e IA — Planeada

- Registro mediante fotografía.
- IA de reconocimiento nutricional.

Condición: requiere definición previa de privacidad, proveedor, costos, consentimiento, revisión manual y alternativa sin IA. La opción “Foto · Próximamente” actual no realiza análisis.

### v2.3 — ¿Qué cocino? — Planeada

- Asistencia simple para decidir qué cocinar.

El alcance funcional y el flujo todavía deben diseñarse. No hay recetas, inventario, planificador ni lista de compras implementados.

### v2.4 — Integración Gym ↔ Nutrition — Planeada

- Conexión explícita entre información de entrenamiento y nutrición.

La dirección de datos, objetivos, reglas y privacidad todavía deben definirse. Actualmente los módulos están aislados y esa separación no debe romperse durante el diseño.

### v3.0 — Plataforma sincronizada — Planeada

- Sincronización.
- Uso multidispositivo.
- Compartir progreso.
- Funciones para entrenador.

Requiere arquitectura de cuentas, backend, seguridad, privacidad, resolución de conflictos, migración desde datos locales y continuidad offline. No existe backend en la versión actual.

## Prioridades permanentes

1. Estabilidad y conservación de datos.
2. Compatibilidad con Gym existente.
3. Velocidad y simplicidad móvil.
4. Aislamiento de módulos.
5. Privacidad y control del usuario.
6. Funciones nuevas solo después de diseño y aprobación.
