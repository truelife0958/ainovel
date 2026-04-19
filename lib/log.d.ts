export type LogFields = Record<string, unknown>;
export type LogLevel = "info" | "warn" | "error";
export const log: {
  info: (event: string, fields?: LogFields) => void;
  warn: (event: string, fields?: LogFields) => void;
  error: (event: string, fields?: LogFields) => void;
};
