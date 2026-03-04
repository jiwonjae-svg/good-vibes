/**
 * App logger that writes to both console and a file (dailyglow_log.txt).
 * File path: app's documentDirectory/dailyglow_log.txt
 * On Android: /data/user/0/com.jiwonjae.dailyglow/files/dailyglow_log.txt
 * On iOS: .../Documents/dailyglow_log.txt
 */
import { Platform } from 'react-native';

const LOG_FILENAME = 'dailyglow_log.txt';

function timestamp(): string {
  return new Date().toISOString();
}

async function writeToFile(level: string, message: string, data?: unknown): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const fs = await import('expo-file-system/legacy');
    const dir = fs.documentDirectory;
    if (!dir) return;

    const path = `${dir}${LOG_FILENAME}`;
    const line = `[${timestamp()}] [${level}] ${message}${data != null ? ' ' + JSON.stringify(data) : ''}\n`;

    const current = await fs.readAsStringAsync(path).catch(() => '');
    await fs.writeAsStringAsync(path, current + line);
  } catch {
    // Silent - don't break app if file write fails
  }
}

function log(level: 'log' | 'warn' | 'error', message: string, data?: unknown): void {
  const fn = level === 'log' ? console.log : level === 'warn' ? console.warn : console.error;
  if (data != null) {
    fn(message, data);
  } else {
    fn(message);
  }
  writeToFile(level.toUpperCase(), message, data).catch(() => {});
}

export const appLog = {
  log: (msg: string, data?: unknown) => log('log', msg, data),
  warn: (msg: string, data?: unknown) => log('warn', msg, data),
  error: (msg: string, data?: unknown) => log('error', msg, data),
};

/** Path to the log file (for displaying in settings/debug UI). Resolves async. */
export async function getLogFilePath(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const fs = await import('expo-file-system/legacy');
    return fs.documentDirectory ? `${fs.documentDirectory}${LOG_FILENAME}` : null;
  } catch {
    return null;
  }
}

export type LogStatus = {
  path: string | null;
  content: string;
  writeTestOk: boolean;
  writeTestError: string | null;
  readError: string | null;
};

/** Get full log status for debug UI: path, content, and write test result. */
export async function getLogStatus(): Promise<LogStatus> {
  const result: LogStatus = { path: null, content: '', writeTestOk: false, writeTestError: null, readError: null };
  if (Platform.OS === 'web') return result;

  try {
    const fs = await import('expo-file-system/legacy');
    const dir = fs.documentDirectory;
    if (!dir) return result;

    const path = `${dir}${LOG_FILENAME}`;
    result.path = path;

    try {
      result.content = await fs.readAsStringAsync(path);
    } catch (e: any) {
      result.readError = e?.message ?? String(e);
    }

    try {
      const testLine = `[${new Date().toISOString()}] [LOG] Test write from Log Status\n`;
      const current = result.content; // use already-read content, or '' if read failed
      await fs.writeAsStringAsync(path, current + testLine);
      result.writeTestOk = true;
      result.content = result.content + testLine; // append for display
    } catch (e: any) {
      result.writeTestError = e?.message ?? String(e);
    }
  } catch (e: any) {
    result.writeTestError = e?.message ?? String(e);
  }
  return result;
}
