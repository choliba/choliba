export interface Writable {
  write(chunk: string): void;
}

export interface WritableWithColumns extends Writable {
  columns?: number;
  isTTY?: boolean;
}

export const defaultStdout: WritableWithColumns = process.stdout;
export const defaultStderr: WritableWithColumns = process.stderr;

export function writeStdout(text: string, out: Writable = defaultStdout): void {
  out.write(text);
}

export function writeStderr(text: string, err: Writable = defaultStderr): void {
  err.write(text);
}

export function isStdoutTty(out: WritableWithColumns = defaultStdout): boolean {
  return out.isTTY === true;
}
