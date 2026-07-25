import type { Command } from '../shell/types';
import { ls } from './ls';
import { cat } from './cat';
import { head } from './head';
import { tail } from './tail';
import { grep } from './grep';
import { find } from './find';
import { tree } from './tree';
import { more, less } from './more';
import { cd } from './cd';
import { pwd } from './pwd';
import { wc } from './wc';
import { clear } from './clear';
import { exit } from './exit';
import { whoami } from './whoami';

/** Built-in /bin command set. Register more apps here — that's the only wiring. */
export const builtinApps: Command[] = [
  ls, cat, head, tail, grep, find, tree, more, less, cd, pwd, wc, clear, exit, whoami,
];
