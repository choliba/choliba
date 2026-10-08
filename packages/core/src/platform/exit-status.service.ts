import { Injectable } from '@nestjs/common';

/** The exit code a command chose (0 until one says otherwise); `main.ts` hands it to the process. */
@Injectable()
export class ExitStatus {
  private value = 0;

  set(code: number): void {
    this.value = code;
  }

  code(): number {
    return this.value;
  }
}
