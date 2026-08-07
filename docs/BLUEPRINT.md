# Blueprint de FORZA

## Visión

FORZA es una aplicación web instalable para registrar entrenamiento y progreso con la menor fricción posible. Su núcleo es Gym. Nutrition agrega contexto diario simple sin reemplazar ni complicar ese núcleo.

## Objetivos

- Registrar rutinas y entrenamientos de forma rápida desde el teléfono.
- Conservar un historial local comprensible y recuperable.
- Mostrar progreso de cargas, volumen, récords y constancia.
- Facilitar decisiones diarias desde el dashboard.
- Complementar el entrenamiento con un registro nutricional mínimo.
- Mantener una experiencia rápida, predecible y apta para una mano.

## Público objetivo

Personas que entrenan fuerza o hipertrofia, siguen rutinas semanales y quieren registrar cargas, repeticiones y evolución sin la complejidad de una plataforma pesada. La experiencia principal está pensada para uso personal desde un teléfono, especialmente como PWA.

## Producto actual

### Gym — Implementado

- Dashboard con entrenamiento del día, actividad reciente, métricas semanales y mensuales, último récord, peso corporal y próximo objetivo.
- Rutinas personalizadas para Día 1, Día 2, Día 3 y Día 4.
- Alta, edición y eliminación de ejercicios de rutina.
- Registro, edición y eliminación de entrenamientos con fecha, ejercicio, peso, series, repeticiones y observaciones.
- Historial con filtros.
- Calendario mensual con detalle de entrenamientos por día.
- Estadísticas por ejercicio con peso, volumen y 1RM estimado mediante Chart.js.
- Récords personales y logros calculados desde los registros.
- Registro corporal y objetivo de peso existentes, sin ampliación planificada actualmente.
- Temporizador de descanso.
- Modo oscuro.
- Exportación CSV.
- Backup y restauración JSON con vista previa y protección ante fallos.

### Nutrition — Implementado

- Tarjeta compacta en el dashboard.
- Totales diarios de calorías, proteína y agua contra sus objetivos.
- Configuración de objetivos diarios.
- Registro de comida por texto.
- Reconocimiento básico mediante catálogo local, con revisión manual antes de guardar.
- Campos opcionales de carbohidratos y grasas en cada entrada.
- Registro inmediato de 250 ml de agua.
- Comidas frecuentes reutilizables en un toque.
- Panel inferior optimizado para móvil, confirmaciones accesibles y soporte de movimiento reducido.
- Opción de fotografía visible como “Próximamente”, sin procesamiento implementado.

## Módulos futuros

Todas las siguientes capacidades están **Planeadas** y no forman parte del producto actual:

- Smart Text para mejorar la interpretación de comidas.
- Meals: comidas completas reutilizables y detectables por nombre.
- Memoria contextual para expresiones como “lo de ayer” o “lo de siempre”, siempre con confirmación.
- Favoritos inteligentes organizados por recientes, favoritas, habituales y horario.
- Registro mediante fotografía e IA de reconocimiento.
- Asistente “¿Qué cocino?”.
- Integración explícita entre Gym y Nutrition.
- Sincronización y uso multidispositivo.
- Compartir progreso.
- Funciones para entrenador.

Estas ideas requieren diseño, aprobación y definición técnica antes de programarse.

## Smart Text v1 — Diseño aprobado, implementación pendiente

Smart Text v1 está **Planeado**. Su objetivo es interpretar texto natural con un catálogo local, sin IA externa, APIs ni modelos online. Toda interpretación incierta debe conservar el texto original, mostrar su nivel de confianza y pedir confirmación antes de guardarse.

### Meals — Planeadas

Una Meal representa una comida completa reutilizable con identidad propia. No es un único alimento ni una entrada histórica: es una plantilla editable formada por varios componentes.

Ejemplo:

```text
Mi desayuno
├── Huevos
├── Yogur
├── Avena
├── Granola
└── Banana
```

El usuario podrá asignarle un nombre personal como “Mi desayuno”, “Mi merienda” o “Mi post entreno”. Smart Text buscará primero coincidencias exactas con esos nombres antes de interpretar cada palabra como alimento.

Usar una Meal nunca debe guardarla de inmediato. El sistema mostrará sus componentes y cantidades actuales para confirmar o corregir.

Flujo planeado:

`Registrar comida → escribir “Mi desayuno” → revisar Meal encontrada → confirmar componentes y cantidades → guardar una nueva entrada diaria`

Modificar la propuesta de un día no debe cambiar automáticamente la Meal original. La actualización de la plantilla debe ser una decisión separada y explícita.

### Memoria contextual — Planeada

La memoria contextual permitirá resolver referencias breves utilizando únicamente datos locales:

- “Lo de ayer”: candidatos registrados el día anterior.
- “Lo de siempre”: Meals o combinaciones habituales compatibles con el contexto actual.
- “Mi desayuno”: Meal guardada con ese nombre.
- “Mi merienda”: Meal guardada con ese nombre.
- “Mi post entreno”: Meal guardada con ese nombre.

Una expresión contextual produce candidatos, no una decisión automática. Siempre debe aparecer una confirmación clara antes de guardar.

Si hay más de un candidato posible, la interfaz debe ofrecer una lista corta y comprensible. Si no hay evidencia suficiente, se conserva el texto y se solicita selección o carga manual.

### Favoritos inteligentes — Planeados

El acceso rápido se dividirá conceptualmente en cuatro grupos:

- **Recientes:** últimas comidas efectivamente registradas.
- **Favoritas:** comidas o Meals marcadas explícitamente por el usuario.
- **Habituales:** combinaciones repetidas con suficiente evidencia local.
- **Por horario:** candidatos frecuentes para la franja horaria actual.

Estas categorías pueden superponerse y no deben duplicar datos. Son vistas calculadas sobre registros y Meals, no cuatro colecciones independientes.

“Habitual” y “por horario” son sugerencias locales. Nunca deben provocar guardado automático ni presentarse como certeza. El usuario conserva la decisión final.

## Experiencia de usuario

FORZA prioriza una tarea principal por contexto. Gym conserva navegación directa entre sus secciones. Nutrition aparece de forma aditiva en Inicio y se opera desde un panel inferior, sin convertirse en una pestaña principal.

Principios de interacción:

- acciones principales grandes y cercanas al pulgar;
- información diaria primero, detalle después;
- confirmaciones breves sin bloquear la pantalla;
- estados vacíos comprensibles;
- datos editables antes de guardar cuando existe incertidumbre;
- conservación del contexto y restauración del foco al cerrar paneles.

## Mapa de navegación actual

```text
FORZA
├── Dashboard / Inicio
│   ├── Resumen Gym
│   └── Tarjeta Nutrition
│       └── Panel Registrar comida
├── Rutinas
├── Entrenamiento
├── Historial
├── Calendario
├── Estadísticas
├── Logros
├── Corporal
└── Extras
    ├── Objetivo de peso
    ├── Temporizador
    ├── Exportar CSV
    └── Backup / Restaurar
```

Nutrition no agrega una pestaña principal ni modifica la navegación de Gym.

## Flujos principales actuales

### Crear o ajustar una rutina

`Rutinas → elegir día → agregar, editar o eliminar ejercicio → guardar automáticamente en el dispositivo`

### Registrar un entrenamiento

`Entrenamiento → elegir día y ejercicio → completar peso, series, repeticiones y datos opcionales → guardar`

El registro alimenta dashboard, historial, calendario, estadísticas, PR y logros.

### Consultar progreso

`Estadísticas → elegir ejercicio, período y métrica → revisar resumen y gráfico`

### Proteger datos Gym

`Extras → Backup JSON → descargar archivo`

`Extras → Restaurar backup → seleccionar archivo → revisar resumen → confirmar`

### Registrar una comida

`Dashboard → Registrar comida → escribir → revisar valores → guardar`

### Repetir una comida frecuente

`Dashboard → Registrar comida → Frecuentes → tocar una comida`

### Registrar agua

`Dashboard → Registrar comida → +250 ml`

## Flujos futuros de Smart Text

Los siguientes flujos están **Planeados** y no existen en la versión actual.

### Usar una Meal por nombre

`Dashboard → Registrar comida → “Mi desayuno” → confirmar Meal detectada → guardar`

### Resolver una expresión contextual

`Dashboard → Registrar comida → “Lo de ayer” → elegir o confirmar candidato → guardar`

### Usar favoritos inteligentes

`Dashboard → Registrar comida → acceso rápido → Recientes / Favoritas / Habituales / Por horario → confirmar → guardar`

## Diseño Mobile First

- PWA en orientación vertical y modo `standalone`.
- Interfaz responsive y controles táctiles.
- Panel Nutrition ajustado a `dvh` y safe areas de iPhone.
- Flujos principales pensados para una mano.
- Viewport de referencia para validación: 390 × 844.
- Escritorio conserva la misma aplicación y amplía el espacio disponible sin crear un producto diferente.

## Filosofía de simplicidad

FORZA no intenta concentrar todas las funciones posibles. Una capacidad entra al producto solo si resuelve un problema real sin debilitar velocidad, comprensión o estabilidad. Lo implementado y lo planeado deben permanecer claramente separados.
