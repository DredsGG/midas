// Midas — novedades por versión (español). Actualizar en cada versión: frases cortas, desde el punto de vista de quien lo usa.
((w) => {
  const k = Symbol.for('alp.changelog');
  const all = w[k] || (w[k] = {});
  all.es = {
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
