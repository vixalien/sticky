export enum StickyErrorType {
  FILE_NOT_FOUND,
  FILE_CORRUPTED,
  NO_PERMISSION,
  UNKNOWN,
}

export class StickyError {
  message: string;
  type: StickyErrorType;

  constructor(type: StickyErrorType, message: string) {
    this.message = message;
    this.type = type;
  }
}
