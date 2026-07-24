// Shared content types — used by BOTH the compiler (scripts/build-content.ts)
// and the runtime (src/content/*). This is the contract between the content
// layer and the framework layer.
//
// The content tree is intentionally loose: it's just a directory of markdown
// files. A file's path IS its identity (slug). No predefined categories.

/** One compiled markdown document. */
export interface Document {
  /** Path-like id, derived from the file: `about`, `blog/hello`. */
  slug: string;
  /** First `# h1` (else the slug). */
  title: string;
  /** Raw markdown body. */
  body: string;
  /** Source file path relative to content/. */
  path: string;
  /**
   * Handler kind. Derived from a shebang first line (`#!tui`, `#!app`, ...);
   * defaults to `page` for plain `# Title` documents. The runtime dispatches on
   * this to decide how the document behaves as a command.
   */
  kind: string;
  /** TUI app declarations found inside this document's body (inline `<!-- tui:app -->`). */
  apps: AppDecl[];
}

/** A `<!-- tui:app name=".." prompt=".." -->` directive collected for codegen. */
export interface AppDecl {
  name: string;
  prompt: string;
  source: string;
}

/** The compiled manifest — the only thing the runtime imports from the content layer. */
export interface Manifest {
  documents: Document[];
  /** All TUI app declarations across every document (input for future LLM codegen). */
  apps: AppDecl[];
}
