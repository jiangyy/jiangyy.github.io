import type { Command } from '../shell/types';
import { ls } from './ls';
import { cat } from './cat';
import { cd } from './cd';
import { pwd } from './pwd';
import { wc } from './wc';
import { clear } from './clear';
import { tui } from './tui';
import { whoami } from './whoami';

/** Built-in /bin command set. Register more apps here — that's the only wiring. */
export const builtinApps: Command[] = [ls, cat, cd, pwd, wc, clear, tui, whoami];
