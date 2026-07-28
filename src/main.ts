// Wiring: build the terminal, registry, store, shell; register /bin commands
// AND one command per content document; wire navigation (history-based, so the
// browser Back button works) and start the REPL.
import { Term } from './term/term';
import { createRegistry } from './shell/registry';
import { Shell } from './shell/shell';
import { createStore } from './content/store';
import { docCommand } from './content/commands';
import { builtinApps } from './apps';

const termHost = document.getElementById('term-host');
if (!termHost) throw new Error('missing #term-host');

const commandFromHash = () => location.hash.replace(/^#/, '').trim();
const initial = commandFromHash() || 'index';

let shell: Shell;
// Internal links push a history entry (so Back works) and run the command.
const term = new Term(termHost, (cmd) => {
  history.pushState({ cmd }, '', '#' + cmd);
  shell.inject(cmd);
});

const registry = createRegistry();
const store = createStore();
for (const cmd of builtinApps) registry.register(cmd);
for (const doc of store.all()) registry.register(docCommand(doc));

shell = new Shell({ term, registry, store, initialCommand: initial });

// Back/Forward: run whatever page the history entry recorded.
window.addEventListener('popstate', (e) => {
  const cmd = (e.state?.cmd as string | undefined) || commandFromHash() || 'index';
  shell.inject(cmd);
});

// Clear the hash on load so a plain refresh returns to home (index).
history.replaceState({ cmd: initial }, '', location.pathname + location.search);

void shell.start();

// Reveal the terminal only once it has been fit at final (post-font-load)
// metrics. The host starts at opacity:0 (index.html) so neither the pre-JS
// full-width frame nor the web-font swap reflow is visible; we fade it in
// after the fit settles. The 1.5s timeout is a safety net in case font
// loading stalls, so the screen never stays blank.
let revealed = false;
const reveal = () => {
  if (revealed) return;
  revealed = true;
  // Fit while still invisible so the font-swap reflow isn't seen, but always
  // reveal — even if fit somehow throws — so the screen never stays blank.
  try {
    term.fit();
  } finally {
    termHost.classList.add('ready');
    term.focus();
  }
};
const fontReady = document.fonts?.ready ?? null;
if (fontReady) fontReady.then(reveal);
else reveal();
setTimeout(reveal, 1500);
