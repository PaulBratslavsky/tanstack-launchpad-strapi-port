import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { backendDir, clientDir, rootDir } from './config.mjs';

/**
 * Environment files for the client and the backend.
 *
 * Some values belong to exactly one app (SESSION_SECRET, APP_KEYS) and some are
 * a contract between the two (PREVIEW_SECRET, and the URLs they use to reach
 * each other). Copying a contract value into two files and hoping they stay
 * equal is how preview mode quietly breaks: Strapi signs a preview URL with one
 * secret, the client validates with another, and all you see is a 401.
 *
 * So shared keys get generated once and written to both files, and every setup
 * run re-checks that they still agree.
 */

/** Placeholders in the `.env.example` files that must become real values. */
const PLACEHOLDER = /tobemodified/g;
const PREVIEW_PLACEHOLDER = 'preview_secret';

export const generateSecret = (): string =>
  crypto.randomUUID().replace(/-/g, '_');

const envPathFor = (dir: string) => path.join(dir, '.env');

export function readEnvValue(file: string, key: string): string | null {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const match = new RegExp(`^${key}=(.*)$`, 'm').exec(text);
  if (!match) return null;
  // dotenv strips unquoted trailing comments and surrounding quotes.
  return match[1]
    .replace(/\s+#.*$/, '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

export function writeEnvValue(file: string, key: string, value: string): void {
  const text = fs.readFileSync(file, 'utf8');
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const next = pattern.test(text)
    ? text.replace(pattern, `${key}=${value}`)
    : `${text.replace(/\n*$/, '\n')}${key}=${value}\n`;
  fs.writeFileSync(file, next, 'utf8');
}

/**
 * Creates `<dir>/.env` from `<dir>/.env.example` if it doesn't exist yet,
 * replacing every `tobemodified` with its own freshly generated secret.
 *
 * Never overwrites an existing `.env` — those hold secrets someone may be
 * relying on. Returns whether a file was created.
 */
export function ensureEnvFile(dir: string, label: string): boolean {
  const examplePath = path.join(dir, '.env.example');
  const envPath = envPathFor(dir);

  if (!fs.existsSync(examplePath)) {
    throw new Error(`${label}: no .env.example found at ${examplePath}`);
  }

  if (fs.existsSync(envPath)) {
    console.log(`  ${label}: .env already exists, leaving it alone`);
    return false;
  }

  const contents = fs
    .readFileSync(examplePath, 'utf8')
    // A function replacement runs per match, so each placeholder gets a
    // distinct secret rather than all of them sharing one.
    .replace(PLACEHOLDER, generateSecret);

  fs.writeFileSync(envPath, contents, 'utf8');
  console.log(`  ${label}: created .env from .env.example`);
  return true;
}

/**
 * Makes sure the client and the backend agree on PREVIEW_SECRET, generating one
 * if neither has a real value yet. Reports what it did — a silently rewritten
 * secret is worse than a noisy one.
 */
export function reconcilePreviewSecret(): string {
  const clientEnv = envPathFor(clientDir);
  const backendEnv = envPathFor(backendDir);

  const isReal = (value: string | null): value is string =>
    !!value && value !== PREVIEW_PLACEHOLDER && value !== 'tobemodified';

  const clientValue = readEnvValue(clientEnv, 'PREVIEW_SECRET');
  const backendValue = readEnvValue(backendEnv, 'PREVIEW_SECRET');

  if (isReal(clientValue) && clientValue === backendValue) {
    console.log('  PREVIEW_SECRET: already shared between client and backend');
    return clientValue;
  }

  // Prefer a real existing value over minting a new one, so re-running setup
  // doesn't invalidate a secret already configured in the Strapi admin.
  const secret = isReal(clientValue)
    ? clientValue
    : isReal(backendValue)
      ? backendValue
      : generateSecret();

  writeEnvValue(clientEnv, 'PREVIEW_SECRET', secret);
  writeEnvValue(backendEnv, 'PREVIEW_SECRET', secret);

  const reason =
    isReal(clientValue) || isReal(backendValue)
      ? 'client and backend disagreed — synced them'
      : 'generated a new shared value';
  console.log(`  PREVIEW_SECRET: ${reason}`);

  return secret;
}

/** Everything the two apps need before either will work. */
export interface CheckResult {
  ok: boolean;
  problems: string[];
}

export function checkEnv(): CheckResult {
  const problems: string[] = [];
  const clientEnv = envPathFor(clientDir);
  const backendEnv = envPathFor(backendDir);

  if (!fs.existsSync(clientEnv)) {
    problems.push('client/.env is missing — run `yarn setup`');
  }
  if (!fs.existsSync(backendEnv)) {
    problems.push('strapi/.env is missing — run `yarn setup`');
  }
  if (problems.length) return { ok: false, problems };

  const required: Array<[string, string, string]> = [
    [clientEnv, 'VITE_STRAPI_URL', 'client'],
    [clientEnv, 'PREVIEW_SECRET', 'client'],
    [clientEnv, 'SESSION_SECRET', 'client'],
    [backendEnv, 'PREVIEW_SECRET', 'strapi'],
    [backendEnv, 'APP_KEYS', 'strapi'],
    [backendEnv, 'ADMIN_JWT_SECRET', 'strapi'],
  ];

  for (const [file, key, label] of required) {
    const value = readEnvValue(file, key);
    if (!value) {
      problems.push(`${label}/.env: ${key} is missing or empty`);
    } else if (value.includes('tobemodified') || value === PREVIEW_PLACEHOLDER) {
      problems.push(
        `${label}/.env: ${key} is still the placeholder "${value}" — replace it with a real value`
      );
    }
  }

  // The contract that broke preview mode the last time it drifted.
  const clientPreview = readEnvValue(clientEnv, 'PREVIEW_SECRET');
  const backendPreview = readEnvValue(backendEnv, 'PREVIEW_SECRET');
  if (clientPreview && backendPreview && clientPreview !== backendPreview) {
    problems.push(
      'PREVIEW_SECRET differs between client/.env and strapi/.env — Strapi will sign preview URLs the client rejects with 401. Run `yarn setup` to sync them.'
    );
  }

  const sessionSecret = readEnvValue(clientEnv, 'SESSION_SECRET');
  if (sessionSecret && sessionSecret.length < 32) {
    problems.push(
      `client/.env: SESSION_SECRET must be at least 32 characters (currently ${sessionSecret.length})`
    );
  }

  // CLIENT_URL is what Strapi points the preview iframe at.
  const clientUrl = readEnvValue(backendEnv, 'CLIENT_URL');
  const clientPort = readEnvValue(clientEnv, 'PORT');
  if (clientUrl && clientPort && !clientUrl.includes(`:${clientPort}`)) {
    problems.push(
      `strapi/.env: CLIENT_URL is ${clientUrl} but the client runs on port ${clientPort} — preview links will point at the wrong place`
    );
  }

  return { ok: problems.length === 0, problems };
}

export function reportCheck(result: CheckResult): void {
  if (result.ok) {
    console.log('✓ Environment looks consistent.');
    return;
  }
  console.error('\n✖ Environment problems:\n');
  for (const problem of result.problems) console.error(`  • ${problem}`);
  console.error(`\nChecked against ${path.relative(process.cwd(), rootDir) || '.'}\n`);
}
