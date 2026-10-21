import type { Container } from '@choliba/kernel';

/** A service a spec replaces in the shell, made with `replace`. */
export interface ShellOverride {
  readonly apply: (container: Container) => void;
}
