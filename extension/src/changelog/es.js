// Midas — novedades por versión (español). Actualizar en cada versión: frases cortas, desde el punto de vista de quien lo usa.
((w) => {
  const k = Symbol.for('alp.changelog');
  const all = w[k] || (w[k] = {});
  all.es = {
    '0.19.14': [
      "\"Siguiente\" en el panel y en el popup muestra la sección y la unidad como las muestra Duolingo (\"sección 4, unidad 49\").",
      "Con dos pestañas de Duolingo abiertas no se pierde ninguna línea del registro, y una pestaña abierta después ya no le quita el grind a la pestaña de atrás.",
      "Midas ya no pulsa botones de otras extensiones (como el panel de Duolingo PRO) y no se queda colgado en una lectura de Duolingo que no responde: se rinde a los 30 s y vuelve a intentar.",
      "\"Copiar\" del registro ya no incluye el número de la cuenta.",
    ],
    '0.19.13': [
      "Los ejercicios de completar la traducción escribiendo (\"Completa la traducción\") vuelven a responderse. El campo del hueco cambió de formato en Duolingo y Midas no lo encontraba: el ejercicio se saltaba.",
    ],
    '0.19.12': [
      "Cuando una lección o historia no se abre, el registro dice qué pantalla estaba abierta (dirección, si la pestaña estaba oculta y los elementos de la pantalla, sin las palabras de la respuesta). Ayuda a encontrar qué cambió en Duolingo.",
    ],
    '0.19.11': [
      "Cuando la página muestra un nodo activo distinto del que indica el camino que leyó Midas, el grind abre el de la página. Antes intentaba el otro por su dirección directa, Duolingo respondía con error 500 y el grind pasaba horas en \"atascado, esperando, recargando\".",
      "Cambiar de curso reinicia los nodos saltados y el contador de atascado del curso anterior.",
      "Si el grind se atasca 3 veces seguidas sin avanzar, el registro y el panel dicen qué nodo no se abre y por qué.",
    ],
    '0.19.10': [
      'Cambiar el preset de velocidad (Rage, Legit o Manual) en el popup o en el panel de otra pestaña ahora vale al instante para la pestaña que corre el grind. Antes podía seguir con el preset anterior hasta 1 hora, hasta la próxima recarga.',
      'Detener en el popup ahora detiene el grind aunque otra pestaña de Duolingo esté delante.',
      'Una configuración antigua, sin preset guardado, muestra en el panel y en el popup el preset que de verdad se usa.',
      'El cuadro "Nueva versión" ya no parpadea cada 5 s mientras está abierto.',
    ],
    '0.19.9': [
      'Cuando Duolingo se cae (error del servidor) o se va el internet, Midas espera y vuelve a comprobar con intervalos crecientes, en vez de recargar la página en serie, saltar nodos o abandonar la lección; cuando el sitio vuelve, retoma solo.',
      'La caída no cuenta como ritmo lento en la estimación de tiempo.',
    ],
    '0.19.8': [
      'Cuando Midas recarga la página en mitad de una lección (actualización, vigilancia), ya no aparece el aviso "¿Volver a cargar el sitio?" y el grind no se queda esperando un clic.',
    ],
    '0.19.7': [
      'Los ejercicios de completar la frase escribiendo que venían sin la palabra del hueco ahora se responden. Antes se saltaban, y en Legendario se abandonaba la lección entera.',
    ],
    '0.19.6': [
      'Los ejercicios de escribir (como "Completa la traducción") ya no se atascan mientras el ejercicio anterior aún está saliendo de la pantalla.',
    ],
    '0.19.5': [
      'Nuevo botón Apoyar ♥ en el pie, opcional: Pix (Brasil) o GitHub Sponsors (otros países). No cambia nada en Midas.',
    ],
    '0.19.2': [
      'Los ejercicios de completar escribiendo (p. ej. "Completa la traducción") ya no se atascan cuando otra extensión de Duolingo está abierta al mismo tiempo.',
    ],
    '0.19.1': [
      'Después de una actualización, el grind vuelve al instante. Antes, la pestaña podía quedarse quieta hasta 4 min creyendo que otra pestaña seguía corriendo.',
    ],
    '0.19.0': [
      'Si la pestaña del grind se cierra, el navegador se reinicia o el grind se atasca, Midas lo vuelve a iniciar solo en hasta 10 min, en una pestaña en segundo plano.',
      'Cada reinicio queda en el registro con fecha, hora y motivo.',
      'Nuevo interruptor "Reiniciar solo si se detiene" (activado de fábrica) en el panel y en el popup. Para detenerlo del todo, usa Detener.',
    ],
    '0.18.1': [
      'Pulsar Iniciar dos veces seguidas (o en el popup y en el panel) ya no detiene el grind justo después de empezar.',
    ],
    '0.18.0': [
      'Curso nuevo: Midas responde solo las preguntas de bienvenida de Duolingo (nivel más bajo, empezar desde cero) y sigue directo con el grind.',
    ],
    '0.17.3': [
      'La estimación se mide sin parar al ritmo real de la última 1 h 30, baja cada segundo con el grind en marcha y muestra el ritmo (pasos por hora).',
    ],
    '0.17.1': [
      'La estimación de tiempo ahora usa el ritmo real de las últimas 3 horas (con recargas y ejercicios de habla trabados) y ya no salta de una lectura a otra.',
    ],
    '0.17.0': [
      'Con Duolingo abierto, Midas busca versión nueva solo: al abrir, cada 30 min y cuando vuelves a la pestaña.',
      'El aviso de versión nueva aparece al instante, sin recargar; la X solo lo pospone 1 hora (o hasta abrir el navegador de nuevo).',
      'Versión marcada como URGENTE: el aviso no se cierra y Midas queda en pausa hasta que actualices.',
    ],
    '0.16.4': [
      'Los cuadros de novedades, versión nueva y tutorial quedan centrados en la parte de abajo de la pantalla, sin tapar el próximo nodo del camino.',
    ],
    '0.16.3': [
      'La ventana de Midas ya no queda cortada ni deja de redimensionarse cuando Duolingo responde con error: el log parte las líneas largas.',
      'Los errores del servidor de Duolingo aparecen en el log con la dirección corta, sin el número de tu cuenta (y ya no va en Reportar bug).',
    ],
    '0.16.2': [
      'La recarga por camino desactualizado solo ocurre cuando la pestaña muestra otro nodo como activo; con la pestaña en segundo plano Midas abre la lección directo, sin perder tiempo.',
    ],
    '0.16.1': [
      'Si el camino en la pestaña queda desactualizado (por ejemplo, otra pestaña avanzó el curso), Midas recarga la página en vez de ir y volver entre Practicar y Aprender.',
    ],
    '0.16.0': [
      'El aviso de versión nueva, las novedades y el tutorial ahora aparecen solos en el centro de la página de Duolingo, sin abrir el panel.',
      'El aviso de versión nueva muestra lo que cambió en tu idioma y vuelve cada vez que abres la página hasta que actualices; la X lo oculta hasta la próxima versión.',
      'Los cuadros no oscurecen ni bloquean el sitio, no roban el foco y esperan a que salgas de una lección que haces a mano.',
    ],
    '0.15.0': [
      'Ahora Midas también funciona en Edge, Brave, Opera GX y Firefox, además de Chrome.',
      'Tutorial de primer uso: puedes abrirlo de nuevo cuando quieras con el botón "?".',
      'Este cuadro aparece una vez después de cada actualización, contando qué cambió.',
      'En Firefox, Midas avisa si se quitó su permiso para duolingo.com y te ayuda a darlo de nuevo.',
    ],
  };
})(globalThis);
