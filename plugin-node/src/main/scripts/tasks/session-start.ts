import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
import * as child_process from 'node:child_process';
import * as os from 'node:os';

export interface InstallOptions {
  version: string;
  cacheDir: string;
  pluginRoot: string;
  forcePlatform?: string;  // for testing; overrides actual platform detection
}

export function installRuntime(opts: InstallOptions): void {
  const { version, cacheDir, pluginRoot } = opts;
  const runtimeDir = path.join(cacheDir, `runtime-${version}`);
  const bin = path.join(runtimeDir, 'bin', 'shipsmooth-tasks');

  if (isExecutable(bin)) {
    return;
  }

  const platform = opts.forcePlatform ?? detectPlatform();
  if (platform !== 'linux-x64') {
    throw new Error(`shipsmooth: platform ${platform} is not yet supported`);
  }

  const localRuntime = path.join(pluginRoot, 'runtime');
  if (fs.existsSync(localRuntime)) {
    fs.cpSync(localRuntime, runtimeDir, { recursive: true });
    fs.chmodSync(bin, 0o755);
    console.log(`shipsmooth: runtime ${version} installed at ${runtimeDir} from local build`);
  } else {
    downloadAndInstall(version, runtimeDir);
    console.log(`shipsmooth: runtime ${version} installed at ${runtimeDir}`);
  }
}

function isExecutable(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function detectPlatform(): string {
  const platMap: Record<string, string> = { linux: 'linux', darwin: 'darwin', win32: 'win32' };
  const archMap: Record<string, string> = { x64: 'x64', arm64: 'arm64' };
  const plat = platMap[process.platform] ?? process.platform;
  const arch = archMap[process.arch] ?? process.arch;
  return `${plat}-${arch}`;
}

function downloadAndInstall(version: string, runtimeDir: string): void {
  const url = `https://github.com/bitkentech/shipsmooth/releases/download/v${version}/shipsmooth-tasks-${version}-linux-x64.zip`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shipsmooth-'));
  const zipFile = path.join(tmp, 'runtime.zip');
  const extractDir = `${runtimeDir}.tmp`;

  try {
    downloadFile(url, zipFile);
    fs.mkdirSync(extractDir, { recursive: true });
    child_process.execFileSync('unzip', ['-q', zipFile, '-d', extractDir]);
    fs.renameSync(path.join(extractDir, `shipsmooth-tasks-${version}`), runtimeDir);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
}

function downloadFile(url: string, dest: string): void {
  const file = fs.openSync(dest, 'w');
  try {
    const request = (u: string, depth: number): void => {
      if (depth > 5) throw new Error(`shipsmooth: too many redirects for ${u}`);
      // synchronous via spawnSync curl fallback — https.get is async-only
      const result = child_process.spawnSync('curl', ['-fsSL', u, '-o', dest], { encoding: 'utf8' });
      if (result.status !== 0) {
        throw new Error(`shipsmooth: failed to download runtime: ${result.stderr}`);
      }
    };
    request(url, 0);
  } finally {
    fs.closeSync(file);
  }
}

// CLI entrypoint — invoked by the hooks.json node -e bootstrap
if (require.main === module) {
  const configPath = path.join(__dirname, 'session-start-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const pluginRoot = process.env['CLAUDE_PLUGIN_ROOT'] ?? '';

  try {
    installRuntime({ version: config.version, cacheDir: config.cacheDir, pluginRoot });
  } catch (e: any) {
    process.stderr.write(e.message + '\n');
    process.exit(1);
  }
}