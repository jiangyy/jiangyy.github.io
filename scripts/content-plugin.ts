// Vite plugin: keeps src/generated/content.ts fresh.
// - runs the compiler once at buildStart (covers `vite` and `vite build`)
// - on dev server, recompiles whenever a file under content/ changes and live-reloads
import type { Plugin } from 'vite';
import { buildContent } from './build-content';

export function contentPlugin(): Plugin {
  return {
    name: 'ghpage:content',

    async buildStart() {
      const m = await buildContent();
      this.info(`content: ${m.documents.length} doc(s), ${m.apps.length} app decl(s)`);
    },

    configureServer(server) {
      const onChange = async (file: string) => {
        if (!file.replace(/\\/g, '/').includes('/content/')) return;
        try {
          await buildContent();
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
