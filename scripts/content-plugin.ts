// Vite plugin: keeps src/generated/content.ts fresh.
// - runs the compiler once at buildStart (covers `vite` and `vite build`)
// - on dev server, recompiles whenever a file under content/ changes and live-reloads
// - embeds the home page's text in the HTML (transformIndexHtml) so the site is
//   readable over a plain HTTP fetch (curl, no-JS clients) — the body is otherwise
//   a JS-rendered terminal that looks empty in the raw HTML.
import type { Plugin } from 'vite';
import { buildContent } from './build-content';

export function contentPlugin(): Plugin {
  // Home-page body, captured whenever content is (re)built, so transformIndexHtml
  // can inline it without re-reading the manifest module.
  let homeBody = '';

  return {
    name: 'ghpage:content',

    async buildStart() {
      const m = await buildContent();
      homeBody = m.documents.find((d) => d.slug === 'index')?.body ?? '';
      this.info(`content: ${m.documents.length} doc(s), ${m.apps.length} app decl(s)`);
    },

    transformIndexHtml() {
      if (!homeBody) return;
      // Escape only what HTML requires in text (<, &) — leave '>' alone so the
      // raw text stays readable in `curl` output.
      const text = homeBody.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      return [
        {
          tag: 'noscript',
          children: `<pre>${text}</pre>`,
          injectTo: 'body',
        },
      ];
    },

    configureServer(server) {
      const onChange = async (file: string) => {
        if (!file.replace(/\\/g, '/').includes('/content/')) return;
        try {
          const m = await buildContent();
          homeBody = m.documents.find((d) => d.slug === 'index')?.body ?? '';
          server.ws.send({ type: 'full-reload' });
          server.config.logger.info('content rebuilt', { timestamp: true });
        } catch (e) {
          server.config.logger.error(`content rebuild failed: ${String(e)}`, { error: e as Error });
        }
      };
      server.watcher.on('change', onChange);
      server.watcher.on('add', onChange);
    },
  };
}
