// Midas — what's new per version (English). Update on every release: short sentences, from the user's point of view.
((w) => {
  const k = Symbol.for('alp.changelog');
  const all = w[k] || (w[k] = {});
  all.en = {
    '0.19.16': [
      "When a Legendary lesson is dropped on a typing exercise, the log also shows the short diagnostic of the exercise (as it already did in lessons with \"Skip\"), without the answer.",
    ],
    '0.19.15': [
      "Typing exercises that complete a translation: when the field does not keep the text, Midas tries other ways of typing (including the way the browser types for real) before skipping the exercise, and the log says which way worked.",
    ],
    '0.19.14': [
      "\"Next\" in the panel and popup shows the section and unit the way Duolingo shows them (\"section 4, unit 49\").",
      "With two Duolingo tabs open, no log line is lost, and a tab opened later no longer takes over the grind from the background tab.",
      "Midas no longer clicks buttons from other extensions (like the Duolingo PRO panel) and no longer hangs on a Duolingo request that never answers: it gives up after 30 s and tries again.",
      "\"Copy\" in the log no longer includes the account number.",
    ],
    '0.19.13': [
      "Typing exercises that complete a translation (\"Complete the translation\"): Midas also finds the blank field in its newer formats (field with no type, editable field).",
    ],
    '0.19.12': [
      "When a lesson or story does not open, the log says which screen was open (address, whether the tab was hidden and the elements on screen, without the answer words). It helps find what changed on Duolingo.",
    ],
    '0.19.11': [
      "When the page shows an active node different from the one in the path Midas read, the grind opens the one on the page. Before, it tried the other one by its direct address, Duolingo answered with error 500 and the grind spent hours in \"blocked, waiting, reloading\".",
      "Switching course resets the skipped nodes and the blocked counter from the previous course.",
      "If the grind gets blocked 3 times in a row without progress, the log and the panel say which node does not open and why.",
    ],
    '0.19.10': [
      'Changing the speed preset (Rage, Legit or Manual) in the popup or in the panel of another tab now applies right away to the tab running the grind. Before, it could keep the old preset for up to 1 hour, until the next reload.',
      'Stop in the popup now stops the grind even when another Duolingo tab is in front.',
      'Old settings without a saved preset now show in the panel and popup the preset that is really in use.',
      'The "New version" box no longer flickers every 5 s while it is open.',
    ],
    '0.19.9': [
      'When Duolingo goes down (server error) or your internet drops, Midas waits and checks again at growing intervals instead of reloading the page over and over, skipping nodes or dropping the lesson; when the site is back, it resumes by itself.',
      'The outage does not count against the time estimate as a slow pace.',
    ],
    '0.19.8': [
      'When Midas reloads the page in the middle of a lesson (update, watchdog), the "Reload site?" prompt no longer shows up and the grind no longer waits for a click.',
    ],
    '0.19.7': [
      'Fill-in-the-blank typing exercises that came without the missing word are now answered. Before they were skipped, and in Legendary the whole lesson was dropped.',
    ],
    '0.19.6': [
      'Typing exercises (like "Complete the translation") no longer get stuck while the previous exercise is still leaving the screen.',
    ],
    '0.19.5': [
      'New optional Support ♥ button in the footer: Pix (Brazil) or GitHub Sponsors (other countries). It changes nothing in Midas.',
    ],
    '0.19.2': [
      'Type-to-complete exercises (e.g. "Complete the translation") no longer get stuck when another Duolingo extension is running alongside.',
    ],
    '0.19.1': [
      'After an update, the grind comes back right away. Before, the tab could sit idle for up to 4 min, thinking another tab was still running.',
    ],
    '0.19.0': [
      'If the grind tab closes, the browser restarts or the grind gets stuck, Midas starts it again by itself within 10 min, in a background tab.',
      'Every restart is written to the log with date, time and reason.',
      'New "Restart automatically if it stops" switch (on by default) in the panel and the popup. To stop for good, press Stop.',
    ],
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
