// Run the normal SDK generator in an ignored scratch directory, without editing rundit-sdk.
import { cpSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sdk = resolve(root, '../rundit-sdk');
const scratch = resolve(root, 'node_modules/.cache/rundit-sdk-local');
mkdirSync(resolve(scratch, 'spec'), { recursive: true });
cpSync(resolve(sdk, 'scripts'), resolve(scratch, 'scripts'), { recursive: true });
cpSync(resolve(sdk, 'versions.json'), resolve(scratch, 'versions.json'));
cpSync(resolve(root, '../rundit-back/sdk-packages/openapi/sdk.openapi.json'), resolve(scratch, 'spec/sdk.openapi.json'));
execFileSync(process.execPath, [resolve(scratch, 'scripts/generate-sdk.cjs')], { stdio: 'inherit' });
process.stdout.write(`Local SDK generated at ${scratch}/packages/client\n`);
