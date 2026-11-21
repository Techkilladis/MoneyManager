import withReleaseSigning, { modifyAppBuildGradle } from '../withReleaseSigning';
import type { ExpoConfig } from '@expo/config-types';

const SAMPLE_BUILD_GRADLE_LF = `apply plugin: "com.android.application"
apply plugin: "com.facebook.react"

android {
    defaultConfig {
        applicationId 'com.suriy.moneymanager'
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0.0"
    }
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            shrinkResources (findProperty('android.enableShrinkResourcesInReleaseBuilds')?.toBoolean() ?: false)
            minifyEnabled enableProguardInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
            crunchPngs (findProperty('android.enablePngCrunchInReleaseBuilds')?.toBoolean() ?: true)
        }
    }
}
`;

const SAMPLE_BUILD_GRADLE_CRLF = SAMPLE_BUILD_GRADLE_LF.replace(/\n/g, '\r\n');

describe('plugins/withReleaseSigning', () => {
  describe('modifyAppBuildGradle', () => {
    it('injects signingConfigs.release reading environment variables and project properties', () => {
      const modified = modifyAppBuildGradle(SAMPLE_BUILD_GRADLE_LF);

      expect(modified).toContain('signingConfigs {');
      expect(modified).toContain('release {');
      expect(modified).toContain('System.getenv("ANDROID_KEYSTORE_PATH") ?: findProperty("ANDROID_KEYSTORE_PATH") ?: "release.keystore"');
      expect(modified).toContain('System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: findProperty("ANDROID_KEYSTORE_PASSWORD")');
      expect(modified).toContain('System.getenv("ANDROID_KEY_ALIAS") ?: findProperty("ANDROID_KEY_ALIAS")');
      expect(modified).toContain('System.getenv("ANDROID_KEY_PASSWORD") ?: findProperty("ANDROID_KEY_PASSWORD")');
      expect(modified).toContain('if (keystorePassword && keyAlias && keyPassword && file(keystorePath).exists())');
      expect(modified).toContain('storeFile file(keystorePath)');
      expect(modified).toContain('storePassword keystorePassword');
      expect(modified).toContain('keyAlias keyAlias');
      expect(modified).toContain('keyPassword keyPassword');
    });

    it('modifies buildTypes.release to conditionally use signingConfigs.release or fall back to debug', () => {
      const modified = modifyAppBuildGradle(SAMPLE_BUILD_GRADLE_LF);

      expect(modified).toContain('def hasReleaseSigning = signingConfigs.release.storeFile && signingConfigs.release.storeFile.exists()');
      expect(modified).toContain('signingConfig hasReleaseSigning ? signingConfigs.release : signingConfigs.debug');

      // debug build type should remain intact
      const debugMatch = modified.match(/debug\s*\{[\s\S]*?signingConfig signingConfigs\.debug[\s\S]*?\}/);
      expect(debugMatch).not.toBeNull();
    });

    it('is idempotent: running repeatedly does not duplicate release signing blocks or config', () => {
      const firstPass = modifyAppBuildGradle(SAMPLE_BUILD_GRADLE_LF);
      const secondPass = modifyAppBuildGradle(firstPass);

      expect(secondPass).toBe(firstPass);

      // Verify release block only appears once in signingConfigs
      const releaseBlockCount = (secondPass.match(/def keystorePath = System\.getenv/g) || []).length;
      expect(releaseBlockCount).toBe(1);

      // Verify conditional signing config only appears once in release build type
      const conditionalConfigCount = (secondPass.match(/def hasReleaseSigning =/g) || []).length;
      expect(conditionalConfigCount).toBe(1);
    });

    it('handles LF line endings cleanly', () => {
      const modified = modifyAppBuildGradle(SAMPLE_BUILD_GRADLE_LF);

      expect(modified).not.toContain('\r');
      expect(modified).toContain('\n');
      expect(modified).toContain('signingConfigs {');
    });

    it('handles CRLF line endings cleanly', () => {
      const modified = modifyAppBuildGradle(SAMPLE_BUILD_GRADLE_CRLF);

      expect(modified).toContain('\r\n');
      expect(modified).toContain('signingConfigs {');

      // Idempotency check with CRLF
      const secondPass = modifyAppBuildGradle(modified);
      expect(secondPass).toBe(modified);
    });

    it('injects signingConfigs when completely missing inside android block', () => {
      const buildGradleWithoutSigningConfigs = `android {
    defaultConfig {
        applicationId 'com.suriy.moneymanager'
    }
    buildTypes {
        release {
            minifyEnabled false
        }
    }
}`;
      const modified = modifyAppBuildGradle(buildGradleWithoutSigningConfigs);
      expect(modified).toContain('signingConfigs {');
      expect(modified).toContain('release {');
      expect(modified).toContain('def hasReleaseSigning =');
    });

    it('injects signingConfig into release buildType if no prior signingConfig directive existed', () => {
      const buildGradleNoPriorDirective = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        release {
            minifyEnabled true
        }
    }
}`;
      const modified = modifyAppBuildGradle(buildGradleNoPriorDirective);
      expect(modified).toContain('def hasReleaseSigning =');
      expect(modified).toContain('signingConfig hasReleaseSigning ? signingConfigs.release : signingConfigs.debug');
    });
  });

  describe('withReleaseSigning plugin', () => {
    it('is exported as a function that registers withAppBuildGradle mod', async () => {
      expect(typeof withReleaseSigning).toBe('function');

      const mockConfig: ExpoConfig = {
        name: 'Money Manager',
        slug: 'MoneyManagerExpo52',
      };

      const result = withReleaseSigning(mockConfig);
      // Expo config plugin returns a config with mods configured
      expect(result).toBeDefined();
      expect(result.name).toBe('Money Manager');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mods = (result as any).mods;
      expect(mods).toBeDefined();
      expect(typeof mods.android?.appBuildGradle).toBe('function');

      // Test executing the registered mod action
      const modAction = mods.android.appBuildGradle;
      const actionResult = await modAction({
        modResults: { contents: SAMPLE_BUILD_GRADLE_LF },
      });
      expect(actionResult.modResults.contents).toContain('System.getenv("ANDROID_KEYSTORE_PATH")');
      expect(actionResult.modResults.contents).toContain('def hasReleaseSigning =');
    });
  });
});
