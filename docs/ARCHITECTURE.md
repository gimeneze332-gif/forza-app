# Arquitectura de FORZA

## Resumen técnico

FORZA es una aplicación web estática de una sola página construida con HTML5, CSS y JavaScript Vanilla. No utiliza framework, backend ni proceso de compilación. Los datos viven actualmente en LocalStorage. Chart.js se carga desde CDN para el gráfico de estadísticas. La instalación y el uso offline se apoyan en un manifiesto web y un Service Worker.

## Estructura real

```text
forza-app/
├── index.html
├── style.css
├── script.js
├── nutrition.css
├── nutrition.js
├── manifest.json
├── sw.js
├── img/
│   └── logo-forza.png
├── tests/
│   ├── smoke.test.cjs
│   └── nutrition.test.cjs
├── docs/
│   ├── FORZA_RULES.md
│   ├── BLUEPRINT.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── CHANGELOG.md
├── README.md
└── ROADMAP.md
```

El `ROADMAP.md` de la raíz conserva la hoja de ruta histórica de Gym. `docs/ROADMAP.md` es la hoja oficial de FORZA 2.0 en adelante.

## Responsabilidad de cada archivo

| Archivo | Responsabilidad |
|---|---|
| `index.html` | Estructura completa de la interfaz, navegación Gym, tarjeta y panel de Nutrition, carga ordenada de scripts y registro del Service Worker. |
| `style.css` | Diseño y responsive del módulo Gym y de la estructura general. |
| `script.js` | Estado, persistencia, eventos, cálculos y renderizado de Gym. |
| `nutrition.css` | Estilos aislados de Nutrition, panel móvil, accesibilidad táctil, safe areas y movimiento reducido. |
| `nutrition.js` | Persistencia y comportamiento de Nutrition, catálogo local, totales diarios, frecuentes, agua y feedback. |
| `manifest.json` | Identidad PWA: nombre, icono, colores, orientación, alcance y modo standalone. |
| `sw.js` | Precarga de recursos, actualización de caché y fallback offline. |
| `img/logo-forza.png` | Icono y marca visual de la aplicación. |
| `tests/smoke.test.cjs` | Pruebas básicas del núcleo Gym y tolerancia a datos dañados. |
| `tests/nutrition.test.cjs` | Pruebas de Nutrition y verificación de aislamiento respecto de Gym. |

## Flujo de inicialización

1. El navegador interpreta `index.html` y carga `style.css` y `nutrition.css`.
2. Chart.js se solicita desde CDN.
3. Al final del documento se carga primero `script.js` y después `nutrition.js`.
4. Gym registra `initializeApp()` en `DOMContentLoaded`. Esa función carga modo oscuro y renderiza rutinas, dashboard, historial, cuerpo, estadísticas, objetivo y temporizador.
5. Nutrition registra su propio callback en `DOMContentLoaded`, dentro de un bloque `try/catch`. Lee solo sus claves, conecta sus eventos y renderiza su tarjeta.
6. En el evento `load`, `index.html` registra `sw.js` con alcance `./`.

El orden Gym → Nutrition es deliberado. Un fallo durante la inicialización de Nutrition se registra en consola y no impide que Gym continúe disponible.

## Persistencia

No existe base de datos ni servidor. Cada navegador/origen mantiene su propia copia local.

### Claves Gym

| Clave | Contenido |
|---|---|
| `forza_workouts` | Entrenamientos registrados. |
| `forza_routines` | Rutinas organizadas por Día 1 a Día 4. |
| `forza_body` | Mediciones corporales. |
| `forza_goal` | Objetivo de peso. |
| `forza_darkmode` | Preferencia de modo oscuro. |
| `forza_last_backup` | Fecha del último backup conocido. |
| `forza_data_updated_at` | Fecha del último cambio de datos Gym. |

`script.js` usa `readStorage()` para tolerar JSON inválido y valores ausentes. Las funciones de guardado escriben la colección correspondiente y actualizan la marca de cambios cuando aplica.

El backup Gym actual declara `schemaVersion: 1` e incluye entrenamientos, rutinas, mediciones y objetivo. La restauración valida la estructura, muestra un resumen y conserva los datos anteriores si el guardado restaurado falla.

### Claves Nutrition

| Clave | Contenido |
|---|---|
| `forza_nutrition_entries` | Comidas registradas, incluidos macronutrientes opcionales y marca frecuente. |
| `forza_nutrition_hydration` | Entradas de agua por fecha. |
| `forza_nutrition_settings` | Objetivos diarios de calorías, proteína y agua. |

Nutrition no lee ni escribe claves Gym. Sus lecturas validan el tipo general esperado y usan valores seguros cuando el contenido no es válido.

## PWA y Service Worker

`manifest.json` define FORZA como aplicación `standalone`, en orientación `portrait`, con inicio y alcance relativos (`./`) e icono de 512 × 512.

`sw.js` utiliza la caché `forza-v2-nutrition-1` y precarga:

- documento raíz e `index.html`;
- CSS y JavaScript de Gym;
- CSS y JavaScript de Nutrition;
- manifiesto e icono.

Durante la activación elimina cachés con otros nombres y toma control de los clientes. Para solicitudes GET aplica una estrategia network-first: intenta red, actualiza caché si la respuesta es válida y usa caché como fallback. Si falla una navegación, devuelve `index.html` cuando está disponible.

Chart.js no forma parte de la lista de precarga local; si la librería no está disponible, Gym evita crear el gráfico y registra una advertencia.

## Separación entre Gym y Nutrition

- Gym: `script.js` + `style.css` + secciones Gym de `index.html`.
- Nutrition: `nutrition.js` + `nutrition.css` + tarjeta/panel Nutrition de `index.html`.
- Los scripts se cargan en ese orden.
- Nutrition está encapsulado en una IIFE y expone solo utilidades puras mediante `window.ForzaNutrition` para pruebas.
- No hay flujo de datos Nutrition → Gym ni Gym → Nutrition.
- No comparten claves de LocalStorage.
- Nutrition es una interfaz aditiva dentro del dashboard, no una pestaña principal.

## Sistema de pruebas

Las pruebas se ejecutan directamente con Node.js y módulos CommonJS; no hay runner ni dependencia adicional.

### `tests/smoke.test.cjs`

- carga `script.js` en un contexto simulado;
- comprueba cálculos de volumen y 1RM;
- comprueba fechas, normalización y escape HTML;
- verifica datos dañados y datos existentes;
- valida calendario, sesiones, PR y logros;
- comprueba marcas de cambios y backup.

### `tests/nutrition.test.cjs`

- carga `nutrition.js` en un contexto simulado;
- verifica las tres claves exclusivas de Nutrition;
- prueba reconocimiento local, texto desconocido y casos ambiguos;
- comprueba totales diarios, frecuentes y estado calculado;
- confirma que Gym inicia antes que Nutrition;
- confirma que Nutrition no menciona ni modifica claves Gym;
- verifica la tarjeta simplificada y el feedback accesible.

Además de estas pruebas, los cambios visuales móviles se validan manualmente en 390 × 844.

## Archivos críticos y protegidos

- `script.js`: núcleo completo de Gym.
- `style.css`: comportamiento visual global y Gym.
- `index.html`: contrato DOM utilizado por ambos módulos y orden de carga.
- `sw.js`: actualización y disponibilidad offline de la PWA.
- `manifest.json`: instalación y alcance PWA.
- Claves LocalStorage existentes: contrato de compatibilidad con datos guardados.
- `tests/smoke.test.cjs`: red mínima de regresión Gym.

Cualquier cambio en estos elementos requiere análisis de impacto y aprobación.

## Áreas que pueden evolucionar

- `nutrition.js`, `nutrition.css` y sus pruebas pueden evolucionar dentro del aislamiento acordado.
- La documentación puede ampliarse junto con cada versión.
- El catálogo local de alimentos puede evolucionar si se conserva la revisión manual y no se presenta como IA.
- La caché del Service Worker debe versionarse cuando cambien recursos publicados.
- Sincronización, IA, fotografía y conexión Gym ↔ Nutrition son áreas planeadas, no arquitectura actual.

## Arquitectura planeada de Smart Text v1

Esta sección describe diseño futuro aprobado, no código existente. Smart Text deberá permanecer dentro del límite técnico de Nutrition, funcionar offline y no modificar archivos, claves ni funciones Gym.

### Flujo de resolución planeado

```text
Texto original
    ↓
Normalización sin perder el original
    ↓
Resolución contextual
    ├── nombre de Meal
    ├── referencia temporal
    └── referencia habitual
    ↓
Reconocimiento de preparaciones y alimentos
    ↓
Resolución de cantidades
    ↓
Cálculo nutricional y confianza por componente
    ↓
Propuesta editable
    ↓
Confirmación obligatoria cuando existe contexto o incertidumbre
    ↓
Entrada diaria de Nutrition
```

La resolución contextual ocurre antes del catálogo de alimentos. Así, “Mi desayuno” puede resolverse como una Meal completa y no como palabras sueltas. Si no existe una coincidencia contextual válida, el texto continúa por el reconocimiento normal.

### Entidades conceptuales planeadas

#### MealDefinition

Plantilla reutilizable creada por el usuario.

Campos conceptuales:

- identificador estable;
- nombre visible y nombre normalizado;
- alias personales opcionales;
- componentes con referencia de catálogo, cantidad, unidad y preparación;
- totales calculables;
- marca favorita;
- fecha de creación y actualización;
- versión de estructura.

Los totales deben recalcularse desde los componentes. Guardar una Meal no equivale a registrar una comida del día.

#### ContextCandidate

Propuesta temporal producida por una expresión contextual.

Debe indicar:

- tipo de contexto: Meal nombrada, ayer, habitual u horario;
- origen local de la propuesta;
- elementos y cantidades recuperados;
- nivel de confianza;
- explicación breve para el usuario;
- necesidad de confirmación, siempre verdadera para referencias contextuales.

No se persiste como entrada hasta que el usuario confirma.

#### UsageSignal

Señal local derivada de registros confirmados. Permite calcular habituales y candidatos por horario sin duplicar comidas.

Puede considerar:

- identidad de Meal o firma normalizada de componentes;
- cantidad de usos;
- última utilización;
- días y franjas horarias de uso;
- correcciones recientes.

No modifica el catálogo nutricional ni autoriza guardado automático.

### Orden de reconocimiento contextual

1. Coincidencia exacta con nombre o alias de una Meal.
2. Expresión temporal explícita, como “lo de ayer”.
3. Expresión personal con categoría, como “mi desayuno”.
4. Expresión habitual, como “lo de siempre”.
5. Si nada se resuelve con seguridad, reconocimiento normal de alimentos y preparaciones.

Una coincidencia por nombre puede tener confianza alta, pero seguirá requiriendo confirmación porque las cantidades o componentes pueden variar ese día.

### Memoria contextual local

La memoria solo consultará datos Nutrition del dispositivo:

- entradas históricas para referencias recientes y temporales;
- Meals guardadas para nombres personales;
- señales calculadas de repetición y horario;
- correcciones confirmadas por el usuario.

“Lo de ayer” debe limitarse al día calendario anterior. Si hubo varias comidas, se mostrarán candidatos; nunca se elegirá una por su cuenta.

“Lo de siempre” necesita evidencia repetida y un contexto suficiente. Si varias opciones tienen peso similar, se muestran como alternativas. Si no existe evidencia, se informa que no se pudo resolver.

### Favoritos inteligentes como vistas

- **Recientes:** orden cronológico descendente de entradas reutilizables.
- **Favoritas:** marca explícita sobre una Meal o comida reutilizable.
- **Habituales:** ranking calculado por frecuencia y recencia, con umbral mínimo aún por definir antes de implementar.
- **Por horario:** ranking calculado para una franja horaria local, cuyos límites también deben definirse antes de implementar.

Las cuatro vistas deben apuntar a entidades existentes. No deben copiar entradas ni generar nuevas fuentes de verdad.

### Persistencia futura

La implementación deberá usar claves exclusivas de Nutrition y versionadas. Los nombres definitivos se aprobarán antes de programar. Conceptualmente se necesitarán espacios separados para:

- definiciones de Meals;
- memoria de correcciones y alias;
- metadatos de uso solo cuando no puedan calcularse con seguridad desde el historial.

No se deben crear claves Gym ni escribir en ellas. Antes de incorporar nuevas claves deberá definirse migración, validación, backup y comportamiento ante datos dañados.

### Integración con Nutrition existente

Smart Text debe producir el mismo modelo de entrada diaria que Nutrition ya guarda: texto original, componentes, calorías, proteína, carbohidratos, grasas, origen, fecha y marca frecuente cuando corresponda.

Una Meal, un reciente o un habitual son fuentes de una propuesta. Tras la confirmación se crea una entrada diaria nueva; nunca se reutiliza el mismo objeto histórico ni se altera el registro original.

El panel actual “Registrar comida” sigue siendo el punto de entrada. No se agrega pestaña principal. El registro manual debe seguir disponible como salida segura si Smart Text falla.

### Reglas de seguridad funcional

- Toda referencia contextual exige confirmación antes de guardar.
- Ningún candidato debe registrarse por selección implícita, horario o frecuencia.
- Una corrección puntual no cambia una Meal sin una segunda acción explícita.
- El historial es inmutable durante la generación de propuestas.
- No se inventan ingredientes, cantidades ni preparaciones ausentes.
- Un fallo de Smart Text no debe impedir el registro manual ni afectar Gym.
