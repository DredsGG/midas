// Midas — novedades por versión (español). Actualizar en cada versión: frases cortas, desde el punto de vista de quien lo usa.
((w) => {
  const k = Symbol.for('alp.changelog');
  const all = w[k] || (w[k] = {});
  all.es = {
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
