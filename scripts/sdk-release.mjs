import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

function parseVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.(0|[1-9]\d*))?$/.exec(version);
  if (!match || match[0] !== version) throw new Error('Expected an exact SDK version: X.Y.Z or X.Y.Z-rc.N.');
  return match.slice(1).map((part) => part === undefined ? null : BigInt(part));
}

export function releaseTarget(channel, version) {
  const parts = parseVersion(version);
  if (channel !== 'rc' && channel !== 'latest') throw new Error('Channel must be rc or latest.');
  if ((channel === 'rc') !== (parts[3] !== null)) {
    throw new Error('RC versions require rc; stable versions require latest.');
  }
  return channel === 'rc' ? 'main' : 'production';
}

export function isOlderVersion(version, current) {
  const requested = parseVersion(version);
  const installed = parseVersion(current);
  for (let index = 0; index < 3; index++) {
    if (requested[index] !== installed[index]) return requested[index] < installed[index];
  }
  if (requested[3] === null) return false;
  if (installed[3] === null) return true;
  return requested[3] < installed[3];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const branch = releaseTarget(process.env.SDK_CHANNEL, process.env.SDK_VERSION);
  let deploy = true;
  if (process.env.CHECK_CURRENT === 'true') {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
    const current = manifest.dependencies['@rundit-sdk/client'];
    deploy = !isOlderVersion(process.env.SDK_VERSION, current);
    if (!deploy) console.log(`Skipping older SDK ${process.env.SDK_VERSION}; branch already pins ${current}.`);
  }
  appendFileSync(process.env.GITHUB_OUTPUT, `branch=${branch}\ndeploy=${deploy}\n`);
}
