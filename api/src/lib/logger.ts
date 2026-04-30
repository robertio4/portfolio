import { randomUUID } from 'node:crypto';

type Level = 'info' | 'warn' | 'error';

interface Fields {
  [k: string]: unknown;
}

function emit(level: Level, msg: string, fields?: Fields): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, fields?: Fields) => emit('info', msg, fields),
  warn: (msg: string, fields?: Fields) => emit('warn', msg, fields),
  error: (msg: string, fields?: Fields) => emit('error', msg, fields),
};

export function newRequestId(): string {
  return randomUUID().slice(0, 8);
}
