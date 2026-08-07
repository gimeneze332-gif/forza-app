# Hoja de ruta de FORZA

## Fase 0 — Estabilidad y persistencia

Objetivo: proteger el historial antes de sumar funciones.

- Mantener una única implementación por módulo y una única suscripción por evento.
- Validar y versionar los backups JSON.
- Incorporar migraciones de datos por `schemaVersion` sin cambiar las claves actuales de LocalStorage.
- Hacer restauraciones atómicas: validar todo antes de reemplazar datos existentes.
- Mostrar errores de cuota/almacenamiento y ofrecer un backup inmediato.
- Agregar pruebas para altas, ediciones, eliminaciones, filtros, PR, CSV y restauración.
- Probar actualización, instalación y uso sin conexión en Safari/iPhone.
- Siguiente salto recomendado: pasar el almacenamiento principal a IndexedDB, manteniendo una migración automática desde LocalStorage.

Criterio de salida: actualizar la PWA no pierde datos; un backup válido restaura todo y uno inválido no modifica nada.

## Fase 1 — Calendario

- Vista mensual con días entrenados y navegación entre meses.
- Detalle diario con ejercicios, volumen, duración y observaciones.
- Reutilizar el historial existente; no crear una segunda fuente de datos.
- Acceso desde dashboard e historial, optimizado para gestos y pantallas pequeñas.

Criterio de salida: cualquier sesión histórica se encuentra en dos toques y los totales coinciden con el historial.

## Fase 2 — Progreso por ejercicio

- Normalizar nombres de ejercicios para evitar estadísticas partidas por mayúsculas o espacios.
- Mostrar mejor peso, mejor serie, mejor volumen, 1RM estimado y promedio.
- Gráficos por peso, volumen y 1RM con rangos semanal, mensual y total.
- Señalar PR reales diferenciando peso, volumen y 1RM.

Criterio de salida: los cálculos son reproducibles y coinciden con los registros filtrados.

## Fase 3 — Dashboard

- Entrenamiento del día y último entrenamiento.
- Último PR y próximo objetivo.
- Volumen y sesiones reales de la semana y del mes.
- Último peso corporal y tendencia.
- Mantener la identidad visual actual; reorganizar sólo jerarquía y prioridad.

Criterio de salida: el dashboard responde “qué toca hoy, cómo vengo y cuál es el próximo objetivo” sin entrar a otras vistas.

## Fase 4 — Logros

- Catálogo versionado de logros por sesiones, volumen, constancia y marcas.
- Calcular logros desde los datos existentes para que sean recuperables.
- Guardar únicamente estado de lectura/notificación, no duplicar resultados calculables.
- Evitar rachas engañosas: usar semanas objetivo de cuatro días además de días consecutivos.

Criterio de salida: restaurar un backup reconstruye los logros sin duplicarlos.

## Fase 5 — Seguimiento físico

- Gráfico de peso y medidas corporales.
- Comparación por períodos y evolución hacia el objetivo.
- Fotos opcionales con aviso claro de almacenamiento y privacidad.
- Para fotos, usar IndexedDB y exportación separada; no LocalStorage.

Criterio de salida: medidas y fotos pueden respaldarse sin bloquear ni exceder el almacenamiento del navegador.

## Fase 6 — Sincronización futura

- Definir cuentas, privacidad, cifrado, borrado y recuperación antes de elegir proveedor.
- Añadir identificadores estables, `createdAt`, `updatedAt` y estado de borrado a los registros.
- Diseñar sincronización offline-first y resolución explícita de conflictos.
- Mantener exportación local para no depender de la nube.
- Evaluar un backend administrado sólo después de estabilizar el modelo de datos.

Criterio de salida: dos dispositivos convergen sin duplicar entrenamientos ni sobrescribir silenciosamente cambios recientes.

## Orden de versiones sugerido

1. `v6.0`: estabilidad, backups, migraciones y pruebas.
2. `v6.1`: calendario.
3. `v6.2`: progreso por ejercicio.
4. `v6.3`: dashboard.
5. `v6.4`: logros.
6. `v6.5`: seguimiento físico ampliado.
7. `v7.0`: cuentas y sincronización.
