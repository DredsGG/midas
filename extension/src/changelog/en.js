// Midas — what's new per version (English). Update on every release: short sentences, from the user's point of view.
((w) => {
  const k = Symbol.for('alp.changelog');
  const all = w[k] || (w[k] = {});
  all.en = {
    '0.18.1': [
      'Pressing Start twice in a row (or in both the popup and the panel) no longer stops the grind right after it starts.',
    ],
    '0.18.0': [
      'New course: Midas answers Duolingo\'s welcome questions by itself (lowest level, start from scratch) and goes straight on with the grind.',
    ],
    '0.17.3': [
      'The estimate is measured continuously at the real pace of the last 90 minutes, counts down every second while the grind runs and shows the pace (steps per hour).',
    ],
    '0.17.1': [
      'The time estimate now uses the real pace of the last 3 hours (reloads and stuck speaking exercises included) and no longer jumps around between readings.',
    ],
    '0.17.0': [
      'With Duolingo open, Midas looks for a new version by itself: when it opens, every 30 minutes and when you come back to the tab.',
      'The new version notice shows up right away, without reloading; the X only postpones it for 1 hour (or until you open the browser again).',
      'Version marked URGENT: the notice can\'t be closed and Midas stays paused until you update.',
    ],
    '0.16.4': [
      'The What\'s new, new version and tutorial boxes now sit centered at the bottom of the screen, without covering the next node on the path.',
    ],
    '0.16.3': [
      'The Midas window no longer gets cut off or stops resizing when Duolingo answers with an error: the log wraps long lines.',
      'Duolingo server errors show up in the log with a short address, without your account number (and it no longer goes into Report a bug).',
    ],
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
