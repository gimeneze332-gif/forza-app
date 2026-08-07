# Reglas oficiales de FORZA

Este documento es la constitución del proyecto. Toda decisión de producto, diseño o ingeniería debe respetarlo. Si una propuesta contradice estas reglas, primero debe explicarse su impacto y aprobarse de manera explícita.

## Filosofía

FORZA prioriza la simplicidad sobre la cantidad de funciones.

- Menos toques, más progreso.
- Gym nunca se rompe.
- Nutrition complementa Gym; nunca lo reemplaza.
- Mobile First.
- PWA instalable y útil desde el teléfono.
- Sin dependencias innecesarias.
- Experiencia de uso similar a una aplicación nativa.
- Todo flujo principal debe poder usarse con una mano.
- Cada nueva función debe justificar su existencia.
- Antes de programar se diseña.
- Antes de modificar se analiza el impacto.

## Reglas de producto

1. El flujo de creación de rutinas y registro de entrenamientos es crítico y permanece congelado salvo aprobación expresa.
2. El historial, calendario, estadísticas, récords, logros y backups deben conservar sus resultados actuales.
3. Una función nueva no debe añadir navegación, pasos o decisiones si puede resolverse dentro de una pantalla existente.
4. Registrar una comida debe poder completarse normalmente en menos de 30 segundos.
5. Una mejora que añade complejidad sin un beneficio visible no se incorpora.
6. Las funciones planeadas no se presentan como disponibles.

## Reglas de arquitectura

- Mantener HTML, CSS y JavaScript Vanilla mientras el alcance no justifique otra tecnología.
- Gym y Nutrition son módulos independientes. No deben compartir claves de persistencia ni modificar el estado interno del otro.
- `script.js` es el núcleo funcional de Gym y se considera protegido.
- Nutrition debe inicializarse después de Gym y sus fallos deben quedar contenidos.
- Los archivos funcionales se modifican solo dentro del alcance aprobado.
- Una propuesta estructural debe incluir impacto, riesgos, migración y estrategia de reversión antes de implementarse.
- No introducir librerías, servicios o procesos de compilación sin una necesidad demostrable.

## Reglas de CSS

- `style.css` pertenece a Gym y no debe usarse para implementar cambios exclusivos de Nutrition.
- Los estilos de Nutrition permanecen en `nutrition.css` y usan nombres identificables con el prefijo `nutrition-`.
- Conservar la identidad visual actual y reutilizar las variables CSS existentes cuando corresponda.
- Diseñar primero para pantallas móviles y verificar al menos el viewport 390 × 844.
- Respetar `safe-area-inset-*`, tamaños táctiles cómodos, contraste, texto legible, `focus-visible` y `prefers-reduced-motion`.
- Evitar reglas globales nuevas que puedan alterar Gym de manera indirecta.
- Las animaciones deben ser breves, funcionales y no bloquear interacciones.

## Reglas de JavaScript

- Mantener responsabilidades separadas por módulo.
- No modificar `saveWorkout()`, `editWorkout()`, `deleteWorkout()` ni los flujos Gym relacionados sin aprobación expresa.
- Nutrition debe permanecer encapsulado y no depender de variables internas de `script.js`.
- Todo acceso a datos persistentes debe ser explícito y tolerar datos ausentes o inválidos.
- Un error de Nutrition no debe impedir que Gym se inicialice.
- Evitar suscripciones duplicadas, efectos globales innecesarios y lógica silenciosa difícil de recuperar.
- El reconocimiento por catálogo local no debe presentarse como IA ni inventar valores cuando no existe suficiente certeza.
- Los mensajes de interacción deben ser discretos y accesibles; evitar `alert()` en los flujos nuevos.

## Reglas de LocalStorage

- Gym conserva sus claves actuales:
  - `forza_workouts`
  - `forza_routines`
  - `forza_body`
  - `forza_goal`
  - `forza_darkmode`
  - `forza_last_backup`
  - `forza_data_updated_at`
- Nutrition utiliza únicamente:
  - `forza_nutrition_entries`
  - `forza_nutrition_hydration`
  - `forza_nutrition_settings`
- Ningún módulo puede escribir en las claves del otro.
- No renombrar ni eliminar claves existentes sin una migración aprobada, verificable y reversible.
- Antes de restaurar datos se valida la estructura completa.
- Los datos calculables no deben duplicarse innecesariamente.
- Los cambios de esquema futuros deben declarar versión y estrategia de migración.
- LocalStorage sigue siendo la fuente local actual; sincronización o cambio de motor de almacenamiento son decisiones futuras.

## Reglas para nuevas pantallas

- Una pantalla nueva es el último recurso, no la opción predeterminada.
- Antes de crearla se debe demostrar que una tarjeta, modal o panel dentro del flujo actual no alcanza.
- No agregar pestañas principales sin aprobación específica.
- Toda pantalla debe tener una tarea principal clara, una jerarquía simple y una salida evidente.
- Debe poder operarse con una mano y sin scroll innecesario.
- Debe contemplar teclado de iOS, safe areas, foco, cierre, estados vacíos y errores.
- El mapa de navegación debe actualizarse antes de programar el cambio.

## Reglas para futuras funciones de IA

- Toda IA es planeada hasta contar con diseño, proveedor, costos, privacidad y estrategia de error aprobados.
- No llamar IA a un catálogo, reglas locales o coincidencias de texto.
- La IA nunca debe guardar información nutricional inventada de forma silenciosa.
- El usuario debe revisar y poder corregir cualquier resultado antes de guardarlo.
- Las fotografías no se procesan ni transmiten sin consentimiento claro y una política de privacidad definida.
- Debe existir una alternativa manual cuando la IA no esté disponible o tenga baja confianza.
- Una falla de red, proveedor o modelo no debe afectar Gym ni impedir el registro manual.
- No enviar historial, imágenes ni datos personales a terceros sin autorización específica.

## Criterio de aprobación de cambios

Antes de implementar una función nueva se documentan: problema real, flujo propuesto, número de toques, archivos afectados, datos nuevos, impacto sobre Gym, impacto PWA, pruebas y plan de reversión. Después se espera aprobación.
