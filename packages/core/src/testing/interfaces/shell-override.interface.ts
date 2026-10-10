import type { Container } from '../../shell';

/** A service a spec replaces in the shell, made with `replace`. */
export interface ShellOverride {
  readonly apply: (container: Container) => void;
}
