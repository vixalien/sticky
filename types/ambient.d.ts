declare function _(
  id: string,
): string & { printf: (...reps: string[]) => string };
declare function print(args: string): void;
declare function log(obj: object, others?: object[]): void;
declare function log(msg: string, subsitutions?: any[]): void;

declare const pkg: {
  version: string;
  name: string;
};

declare module console {
  export function error(...args: any[]): void;
  export function debug(...args: any[]): void;
  export function log(...args: any[]): void;
}

declare interface String {
  format(...replacements: string[]): string;
  format(...replacements: number[]): string;
}
declare interface Number {
  toFixed(digits: number): number;
}

interface TextDecoderOptions {
  fatal?: boolean;
  ignoreBOM?: boolean;
}

declare class TextDecoder {
  constructor(encoding?: string, options?: TextDecoderOptions);
  decode(input?: ArrayBufferView, options?: TextDecodeOptions): string;
}

interface TextEncodeOptions {
  stream?: boolean;
}

declare class TextEncoder {
  constructor();
  encode(input?: string, options?: TextEncodeOptions): Uint8Array;
}
