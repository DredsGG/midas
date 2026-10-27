// Midas — what's new per version (English). Update on every release: short sentences, from the user's point of view.
((w) => {
  const k = Symbol.for('alp.changelog');
  const all = w[k] || (w[k] = {});
  all.en = {
    '0.16.2': [
      'The out-of-date path reload only happens when the tab shows a different node as active; with the tab in the background Midas opens the lesson directly, without wasting time.',
    ],
    '0.16.1': [
      'If the path in the tab gets out of date (for example, another tab moved the course ahead), Midas reloads the page instead of bouncing between Practice and Learn.',
    ],
    '0.16.0': [
      'Update notice, What\'s new and the tutorial now pop up by themselves in the middle of the Duolingo page, without opening the panel.',
      'The new version notice shows what changed in your language and comes back every time you open the page until you update; the X hides it until the next version.',
      'The boxes don\'t dim or block the site, don\'t steal focus and wait until you leave a lesson you\'re doing by hand.',
    ],
    '0.15.0': [
      'Midas now also works on Edge, Brave, Opera GX and Firefox, not only Chrome.',
      'First-run tutorial: open it again any time with the "?" button.',
      'This box shows up once after every update, telling you what changed.',
      'On Firefox, Midas warns you if its access to duolingo.com was turned off and helps you turn it back on.',
    ],
  };
})(globalThis);
