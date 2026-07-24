// Wiring: build the terminal, registry, store, shell; register /bin commands
// AND one command per content document; start the REPL with the homepage.
import { Term } from './term/term';
import { createRegistry } from './shell/registry';
import { Shell } from './shell/shell';
import { createStore } from './content/store';
import { docCommand } from './content/commands';
import { builtinApps } from './apps';

const termHost = document.getElementById('term-host');
if (!termHost) throw new Error('missing #term-host');

const term = new Term(termHost);
const registry = createRegistry();
const store = createStore();
for (const cmd of builtinApps) registry.register(cmd);
for (const doc of store.all()) registry.register(docCommand(doc));

// URL hash routing: /#papers runs `papers` on load; changing the hash runs the
// matching command. Default landing page is `index`.
const commandFromHash = () => location.hash.replace(/^#/, '').trim();
const shell = new Shell({ term, registry, store, initialCommand: commandFromHash() || 'index' });
window.addEventListener('hashchange', () => {
  const c = commandFromHash();
  if (c) shell.inject(c);
});

term.focus();
void shell.start();

if (document.fonts) document.fonts.ready.then(() => term.fit());
