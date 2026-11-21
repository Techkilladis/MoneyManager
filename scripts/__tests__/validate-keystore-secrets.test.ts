import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Seam under test: scripts/validate-keystore-secrets.js
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  validateSecrets,
  provisionKeystore,
  cleanupKeystore,
  formatEasInstructions,
  writeGitHubOutputs,
  REQUIRED_SECRETS,
  parseArgs,
} = require('../validate-keystore-secrets');

describe('validate-keystore-secrets', () => {
  const tmpDir = path.resolve(__dirname, '../../test-tmp-keystore');
  const scriptPath = path.resolve(__dirname, '../validate-keystore-secrets.js');

  const validEnv = {
    ANDROID_KEYSTORE_BASE64: Buffer.from('dummy-binary-keystore-content').toString('base64'),
    ANDROID_KEYSTORE_PASSWORD: 'keystore-password-123',
    ANDROID_KEY_ALIAS: 'release-key-alias',
    ANDROID_KEY_PASSWORD: 'key-password-456',
  };

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('REQUIRED_SECRETS', () => {
    it('defines the 4 required Android release signing secrets', () => {
      expect(REQUIRED_SECRETS).toEqual([
        'ANDROID_KEYSTORE_BASE64',
        'ANDROID_KEYSTORE_PASSWORD',
        'ANDROID_KEY_ALIAS',
        'ANDROID_KEY_PASSWORD',
      ]);
    });
  });

  describe('validateSecrets', () => {
    it('returns { valid: true, missing: [] } when all four secrets are present and non-empty', () => {
      const result = validateSecrets(validEnv);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
      expect(result.errorMessage).toBeUndefined();
    });

    it('returns valid: false and lists all missing keys when given an empty environment', () => {
      const result = validateSecrets({});
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual([
        'ANDROID_KEYSTORE_BASE64',
        'ANDROID_KEYSTORE_PASSWORD',
        'ANDROID_KEY_ALIAS',
        'ANDROID_KEY_PASSWORD',
      ]);
      expect(result.errorMessage).toBeDefined();
      expect(result.errorMessage).toContain('eas-cli');
    });

    it('identifies single missing secret', () => {
      const env = { ...validEnv };
      delete (env as Record<string, string | undefined>).ANDROID_KEY_PASSWORD;

      const result = validateSecrets(env);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['ANDROID_KEY_PASSWORD']);
      expect(result.errorMessage).toContain('ANDROID_KEY_PASSWORD');
    });

    it('treats empty string values as missing', () => {
      const env = {
        ...validEnv,
        ANDROID_KEYSTORE_PASSWORD: '',
      };

      const result = validateSecrets(env);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['ANDROID_KEYSTORE_PASSWORD']);
    });

    it('treats whitespace-only values as missing', () => {
      const env = {
        ...validEnv,
        ANDROID_KEYSTORE_BASE64: '   \t  \n ',
      };

      const result = validateSecrets(env);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['ANDROID_KEYSTORE_BASE64']);
    });

    it('treats undefined or null values as missing', () => {
      const env = {
        ANDROID_KEYSTORE_BASE64: undefined,
        ANDROID_KEYSTORE_PASSWORD: null as unknown as string,
        ANDROID_KEY_ALIAS: 'valid-alias',
        ANDROID_KEY_PASSWORD: 'valid-password',
      };

      const result = validateSecrets(env as unknown as Record<string, string | undefined>);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD']);
    });
  });

  describe('formatEasInstructions', () => {
    it('includes eas-cli command, credentials keyword, and base64 instructions', () => {
      const instructions = formatEasInstructions(['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEY_PASSWORD']);

      expect(instructions).toContain('eas-cli');
      expect(instructions).toContain('credentials');
      expect(instructions).toContain('base64');
      expect(instructions).toContain('ANDROID_KEYSTORE_BASE64');
      expect(instructions).toContain('ANDROID_KEY_PASSWORD');
    });

    it('includes Linux/macOS and Windows PowerShell base64 encoding snippets', () => {
      const instructions = formatEasInstructions(['ANDROID_KEYSTORE_BASE64']);

      expect(instructions).toContain('base64 -w 0');
      expect(instructions).toContain('[Convert]::ToBase64String');
    });

    it('references GitHub Actions repository secrets path', () => {
      const instructions = formatEasInstructions(['ANDROID_KEYSTORE_PASSWORD']);

      expect(instructions).toContain('Secrets and variables');
    });
  });

  describe('provisionKeystore', () => {
    const targetFile = path.join(tmpDir, 'nested', 'dir', 'release.keystore');
    const rawContent = Buffer.from('FAKE-KEYSTORE-BINARY-PAYLOAD-12345\x00\x01\x02');
    const base64Content = rawContent.toString('base64');

    beforeEach(() => {
      if (fs.existsSync(targetFile)) {
        fs.unlinkSync(targetFile);
      }
    });

    it('decodes base64 string and writes raw binary file to targetPath', () => {
      const result = provisionKeystore(base64Content, targetFile);

      expect(result.path).toBe(targetFile);
      expect(result.size).toBe(rawContent.length);
      expect(fs.existsSync(targetFile)).toBe(true);

      const writtenBytes = fs.readFileSync(targetFile);
      expect(writtenBytes.equals(rawContent)).toBe(true);
    });

    it('safely creates parent directories if they do not exist', () => {
      const deeplyNested = path.join(tmpDir, 'deep', 'sub', 'folder', 'test.keystore');
      if (fs.existsSync(deeplyNested)) {
        fs.unlinkSync(deeplyNested);
      }

      const result = provisionKeystore(base64Content, deeplyNested);
      expect(result.path).toBe(deeplyNested);
      expect(fs.existsSync(deeplyNested)).toBe(true);
      expect(fs.readFileSync(deeplyNested).equals(rawContent)).toBe(true);
    });

    it('overwrites existing file without throwing', () => {
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      fs.writeFileSync(targetFile, 'old-stale-content');

      const result = provisionKeystore(base64Content, targetFile);
      expect(result.size).toBe(rawContent.length);
      expect(fs.readFileSync(targetFile).equals(rawContent)).toBe(true);
    });

    it('throws error when base64 content is empty or whitespace', () => {
      expect(() => {
        provisionKeystore('', targetFile);
      }).toThrow(/base64/i);

      expect(() => {
        provisionKeystore('   ', targetFile);
      }).toThrow(/base64/i);
    });

    it('throws error when targetPath is not provided', () => {
      expect(() => {
        provisionKeystore(base64Content, '');
      }).toThrow(/path/i);
    });
  });

  describe('cleanupKeystore', () => {
    const targetFile = path.join(tmpDir, 'cleanup-target.keystore');

    beforeEach(() => {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
    });

    it('removes the keystore file if it exists and returns true', () => {
      fs.writeFileSync(targetFile, 'to-be-deleted');
      expect(fs.existsSync(targetFile)).toBe(true);

      const result = cleanupKeystore(targetFile);
      expect(result).toBe(true);
      expect(fs.existsSync(targetFile)).toBe(false);
    });

    it('returns false without throwing when the file does not exist', () => {
      const nonExistent = path.join(tmpDir, 'non-existent-keystore.keystore');
      if (fs.existsSync(nonExistent)) {
        fs.unlinkSync(nonExistent);
      }

      const result = cleanupKeystore(nonExistent);
      expect(result).toBe(false);
    });

    it('returns false when given invalid or empty path arguments', () => {
      expect(cleanupKeystore('')).toBe(false);
      expect(cleanupKeystore('   ')).toBe(false);
      expect(cleanupKeystore(null as unknown as string)).toBe(false);
      expect(cleanupKeystore(undefined as unknown as string)).toBe(false);
    });
  });

  describe('writeGitHubOutputs', () => {
    it('appends key-value pairs to GITHUB_OUTPUT and GITHUB_ENV when defined', () => {
      const outputFile = path.join(tmpDir, 'gh_output.txt');
      const envFile = path.join(tmpDir, 'gh_env.txt');
      fs.writeFileSync(outputFile, '');
      fs.writeFileSync(envFile, '');

      const originalOutput = process.env.GITHUB_OUTPUT;
      const originalEnv = process.env.GITHUB_ENV;

      try {
        process.env.GITHUB_OUTPUT = outputFile;
        process.env.GITHUB_ENV = envFile;

        writeGitHubOutputs({
          keystore_path: '/path/to/keystore',
          keystore_ready: true,
        });

        const outputContent = fs.readFileSync(outputFile, 'utf8');
        expect(outputContent).toContain('keystore_path=/path/to/keystore');
        expect(outputContent).toContain('keystore_ready=true');

        const envContent = fs.readFileSync(envFile, 'utf8');
        expect(envContent).toContain('keystore_path=/path/to/keystore');
        expect(envContent).toContain('keystore_ready=true');
      } finally {
        if (originalOutput === undefined) {
          delete process.env.GITHUB_OUTPUT;
        } else {
          process.env.GITHUB_OUTPUT = originalOutput;
        }
        if (originalEnv === undefined) {
          delete process.env.GITHUB_ENV;
        } else {
          process.env.GITHUB_ENV = originalEnv;
        }
      }
    });

    it('gracefully does nothing when GITHUB_OUTPUT and GITHUB_ENV are not set', () => {
      const originalOutput = process.env.GITHUB_OUTPUT;
      const originalEnv = process.env.GITHUB_ENV;

      try {
        delete process.env.GITHUB_OUTPUT;
        delete process.env.GITHUB_ENV;

        expect(() => {
          writeGitHubOutputs({ test_key: 'test_val' });
        }).not.toThrow();
      } finally {
        if (originalOutput === undefined) {
          delete process.env.GITHUB_OUTPUT;
        } else {
          process.env.GITHUB_OUTPUT = originalOutput;
        }
        if (originalEnv === undefined) {
          delete process.env.GITHUB_ENV;
        } else {
          process.env.GITHUB_ENV = originalEnv;
        }
      }
    });
  });

  describe('parseArgs', () => {
    it('returns default options when no arguments provided', () => {
      const options = parseArgs([]);
      expect(options).toEqual({
        cleanup: false,
        cleanupPath: undefined,
        output: undefined,
      });
    });

    it('parses --cleanup without following path', () => {
      const options = parseArgs(['--cleanup']);
      expect(options.cleanup).toBe(true);
      expect(options.cleanupPath).toBeUndefined();
    });

    it('parses --cleanup with specified path', () => {
      const options = parseArgs(['--cleanup', 'custom/path/release.keystore']);
      expect(options.cleanup).toBe(true);
      expect(options.cleanupPath).toBe('custom/path/release.keystore');
    });

    it('parses --output and -o flags', () => {
      const options1 = parseArgs(['--output', 'out/path.keystore']);
      expect(options1.output).toBe('out/path.keystore');

      const options2 = parseArgs(['-o', 'out/short.keystore']);
      expect(options2.output).toBe('out/short.keystore');
    });

    it('handles --cleanup combined with --output', () => {
      const options = parseArgs(['--cleanup', '--output', 'out/path.keystore']);
      expect(options.cleanup).toBe(true);
      expect(options.cleanupPath).toBeUndefined();
      expect(options.output).toBe('out/path.keystore');
    });
  });

  describe('CLI execution', () => {
    const cliOutputDir = path.join(tmpDir, 'cli-run');
    const cliKeystorePath = path.join(cliOutputDir, 'cli-release.keystore');
    const cliGhOutput = path.join(cliOutputDir, 'cli_github_output.txt');

    beforeEach(() => {
      if (!fs.existsSync(cliOutputDir)) {
        fs.mkdirSync(cliOutputDir, { recursive: true });
      }
      if (fs.existsSync(cliKeystorePath)) {
        fs.unlinkSync(cliKeystorePath);
      }
      fs.writeFileSync(cliGhOutput, '');
    });

    it('exits with code 1 and outputs diagnostic EAS instructions when secrets are missing', () => {
      let threw = false;
      let output = '';

      try {
        execSync(`node "${scriptPath}"`, {
          env: {
            ...process.env,
            ANDROID_KEYSTORE_BASE64: '',
            ANDROID_KEYSTORE_PASSWORD: '',
            ANDROID_KEY_ALIAS: '',
            ANDROID_KEY_PASSWORD: '',
          },
          stdio: 'pipe',
          encoding: 'utf8',
        });
      } catch (err: unknown) {
        threw = true;
        const execErr = err as { stdout?: string; stderr?: string; status?: number };
        output = (execErr.stdout || '') + (execErr.stderr || '');
        expect(execErr.status).toBe(1);
      }

      expect(threw).toBe(true);
      expect(output).toContain('eas-cli');
      expect(output).toContain('credentials');
      expect(output).toContain('ANDROID_KEYSTORE_BASE64');
    });

    it('exits 0, provisions keystore, and writes GITHUB_OUTPUT when valid env is supplied', () => {
      const stdout = execSync(`node "${scriptPath}" --output "${cliKeystorePath}"`, {
        env: {
          ...process.env,
          ...validEnv,
          GITHUB_OUTPUT: cliGhOutput,
        },
        encoding: 'utf8',
      });

      expect(stdout).toMatch(/provisioned/i);
      expect(fs.existsSync(cliKeystorePath)).toBe(true);

      const ghOutput = fs.readFileSync(cliGhOutput, 'utf8');
      expect(ghOutput).toContain(`keystore_path=${cliKeystorePath}`);
      expect(ghOutput).toContain('keystore_ready=true');
    });

    it('supports --cleanup [path] flag to remove provisioned keystore and exit 0', () => {
      fs.writeFileSync(cliKeystorePath, 'keystore-data-before-cleanup');
      expect(fs.existsSync(cliKeystorePath)).toBe(true);

      const stdout = execSync(`node "${scriptPath}" --cleanup "${cliKeystorePath}"`, {
        encoding: 'utf8',
      });

      expect(stdout).toMatch(/cleaned up/i);
      expect(fs.existsSync(cliKeystorePath)).toBe(false);
    });

    it('--cleanup exits 0 without error if keystore does not exist', () => {
      if (fs.existsSync(cliKeystorePath)) {
        fs.unlinkSync(cliKeystorePath);
      }

      const stdout = execSync(`node "${scriptPath}" --cleanup "${cliKeystorePath}"`, {
        encoding: 'utf8',
      });

      expect(stdout).toMatch(/no keystore file to clean up|already removed|cleaned up/i);
      expect(fs.existsSync(cliKeystorePath)).toBe(false);
    });

    it('provisions to ANDROID_KEYSTORE_PATH environment variable if --output is not passed', () => {
      const customEnvKeystorePath = path.join(cliOutputDir, 'env-release.keystore');
      if (fs.existsSync(customEnvKeystorePath)) {
        fs.unlinkSync(customEnvKeystorePath);
      }

      const stdout = execSync(`node "${scriptPath}"`, {
        env: {
          ...process.env,
          ...validEnv,
          ANDROID_KEYSTORE_PATH: customEnvKeystorePath,
          GITHUB_OUTPUT: cliGhOutput,
        },
        encoding: 'utf8',
      });

      expect(stdout).toMatch(/provisioned/i);
      expect(fs.existsSync(customEnvKeystorePath)).toBe(true);

      const ghOutput = fs.readFileSync(cliGhOutput, 'utf8');
      expect(ghOutput).toContain(`keystore_path=${customEnvKeystorePath}`);
    });

    it('cleans up ANDROID_KEYSTORE_PATH when --cleanup has no target argument', () => {
      const customEnvKeystorePath = path.join(cliOutputDir, 'env-cleanup.keystore');
      fs.writeFileSync(customEnvKeystorePath, 'to-be-cleaned');
      expect(fs.existsSync(customEnvKeystorePath)).toBe(true);

      const stdout = execSync(`node "${scriptPath}" --cleanup`, {
        env: {
          ...process.env,
          ANDROID_KEYSTORE_PATH: customEnvKeystorePath,
        },
        encoding: 'utf8',
      });

      expect(stdout).toMatch(/cleaned up/i);
      expect(fs.existsSync(customEnvKeystorePath)).toBe(false);
    });
  });
});
