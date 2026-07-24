import type { Command, Registry } from './types';

export function createRegistry(): Registry {
  const cmds = new Map<string, Command>();
  return {
    register(cmd: Command) {
      cmds.set(cmd.name, cmd);
    },
    get(name: string) {
      return cmds.get(name);
    },
    list() {
      return [...cmds.values()];
    },
  };
}
