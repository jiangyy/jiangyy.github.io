// Runtime view over the compiled manifest. The ONLY thing the framework imports
// from the content layer — markdown never touches the runtime.
import { manifest } from '../generated/content';
import type { AppDecl, Document } from './types';

export interface ContentStore {
  all(): Document[];
  get(slug: string): Document | undefined;
  apps(): AppDecl[];
}

export function createStore(): ContentStore {
  return {
    all: () => manifest.documents,
    get: (slug: string) => manifest.documents.find((d) => d.slug === slug),
    apps: () => manifest.apps,
  };
}
