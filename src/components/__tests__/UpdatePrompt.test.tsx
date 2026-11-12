import React from 'react';
import { Modal, Text as RNText } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import * as Updates from 'expo-updates';
import { UpdatePrompt } from '../UpdatePrompt';
import type { UpdateCheckResult } from '@/services/updateService';

describe('UpdatePrompt - Native Update Flow (Seam 1)', () => {
  const nativeDescriptor: UpdateCheckResult = {
    type: 'native',
    latestVersion: '2.0.0',
    currentVersion: '1.0.0',
    downloadUrl: 'https://github.com/Techkilladis/MoneyManager/releases/download/v2.0.0/app-release.apk',
    releaseName: 'Release v2.0.0',
    releaseNotes: 'Bug fixes and performance improvements',
  };

  it('displays the native update modal showing the target version when a newer native release is available', async () => {
    const checkForUpdatesFn = jest.fn(async () => nativeDescriptor);

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <UpdatePrompt
          checkDelayMs={0}
          checkForUpdatesFn={checkForUpdatesFn}
        />
      );
    });

    const root = testRenderer!.root;
    expect(checkForUpdatesFn).toHaveBeenCalledTimes(1);

    // Should find title and version tag in modal
    const textNodes = root.findAllByType(RNText);
    const allText = textNodes.map((n) => n.props.children).flat().join(' ');
    expect(allText).toContain('New App Version Available');
    expect(allText).toContain('2.0.0');
    expect(allText).toContain('Download');
    expect(allText).toContain('Later');
  });

  it('invokes the platform URL opener with the direct APK URL and closes modal on tapping Download', async () => {
    const checkForUpdatesFn = jest.fn(async () => nativeDescriptor);
    const openUrlFn = jest.fn(async () => true);

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <UpdatePrompt
          checkDelayMs={0}
          checkForUpdatesFn={checkForUpdatesFn}
          openUrlFn={openUrlFn}
        />
      );
    });

    const root = testRenderer!.root;
    // Find Download button
    const buttons = root.findAll((node) => node.props?.title === 'Download' || node.props?.children === 'Download');
    expect(buttons.length).toBeGreaterThan(0);

    const downloadButton = buttons[0];
    await act(async () => {
      if (downloadButton.props.onPress) {
        await downloadButton.props.onPress();
      }
    });

    expect(openUrlFn).toHaveBeenCalledWith(nativeDescriptor.downloadUrl);

    // Modal should now be dismissed
    const modals = root.findAllByType(Modal);
    if (modals.length > 0) {
      expect(modals[0].props.visible).toBe(false);
    } else {
      expect(root.children.length).toBe(0);
    }
  });

  it('closes the modal without opening URL on tapping Later', async () => {
    const checkForUpdatesFn = jest.fn(async () => nativeDescriptor);
    const openUrlFn = jest.fn(async () => true);

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <UpdatePrompt
          checkDelayMs={0}
          checkForUpdatesFn={checkForUpdatesFn}
          openUrlFn={openUrlFn}
        />
      );
    });

    const root = testRenderer!.root;
    const laterButtons = root.findAll((node) => node.props?.title === 'Later' || node.props?.children === 'Later');
    expect(laterButtons.length).toBeGreaterThan(0);

    const laterButton = laterButtons[0];
    await act(async () => {
      if (laterButton.props.onPress) {
        await laterButton.props.onPress();
      }
    });

    expect(openUrlFn).not.toHaveBeenCalled();

    // Modal should now be dismissed
    const modals = root.findAllByType(Modal);
    if (modals.length > 0) {
      expect(modals[0].props.visible).toBe(false);
    } else {
      expect(root.children.length).toBe(0);
    }
  });
});

describe('UpdatePrompt - Two-Stage OTA Update Flow (Seam 2)', () => {
  const otaDescriptor: UpdateCheckResult = {
    type: 'ota',
    manifest: { id: 'update-123', createdAt: '2026-11-11' } as never,
  };

  it('displays Stage 1 OTA modal with Update now and Later options when an OTA update is detected', async () => {
    const checkForUpdatesFn = jest.fn(async () => otaDescriptor);

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <UpdatePrompt
          checkDelayMs={0}
          checkForUpdatesFn={checkForUpdatesFn}
        />
      );
    });

    const root = testRenderer!.root;
    expect(checkForUpdatesFn).toHaveBeenCalledTimes(1);

    const textNodes = root.findAllByType(RNText);
    const allText = textNodes.map((n) => n.props.children).flat().join(' ');
    expect(allText).toContain('Update available');
    expect(allText).toContain('Update now');
    expect(allText).toContain('Later');
  });

  it('tapping Later in Stage 1 dismisses the modal', async () => {
    const checkForUpdatesFn = jest.fn(async () => otaDescriptor);

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <UpdatePrompt
          checkDelayMs={0}
          checkForUpdatesFn={checkForUpdatesFn}
        />
      );
    });

    const root = testRenderer!.root;
    const laterButtons = root.findAll((node) => node.props?.title === 'Later' || node.props?.children === 'Later');
    expect(laterButtons.length).toBeGreaterThan(0);

    await act(async () => {
      await laterButtons[0].props.onPress();
    });

    const modals = root.findAllByType(Modal);
    if (modals.length > 0) {
      expect(modals[0].props.visible).toBe(false);
    } else {
      expect(root.children.length).toBe(0);
    }
  });

  it('tapping Update now enters buffering/downloading state and disables dismiss', async () => {
    const checkForUpdatesFn = jest.fn(async () => otaDescriptor);
    let resolveFetch: (() => void) | undefined;
    const fetchUpdateFn = jest.fn(
      () =>
        new Promise<never>((resolve) => {
          resolveFetch = resolve as never;
        })
    );

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <UpdatePrompt
          checkDelayMs={0}
          minDownloadDurationMs={0}
          checkForUpdatesFn={checkForUpdatesFn}
          fetchUpdateFn={fetchUpdateFn}
        />
      );
    });

    const root = testRenderer!.root;
    const updateNowButtons = root.findAll(
      (node) => node.props?.title === 'Update now' || node.props?.children === 'Update now'
    );
    expect(updateNowButtons.length).toBeGreaterThan(0);

    // Tap Update now without resolving fetch yet
    act(() => {
      void updateNowButtons[0].props.onPress();
    });

    // Verify Downloading state is rendered
    const textNodes = root.findAllByType(RNText);
    const allText = textNodes.map((n) => n.props.children).flat().join(' ');
    expect(allText).toContain('Downloading update...');
    expect(allText).toContain('Please do not close the app');

    // Action buttons should not be present during download
    const actionButtons = root.findAll(
      (node) =>
        node.props?.title === 'Update now' ||
        node.props?.title === 'Later' ||
        node.props?.title === 'Restart now'
    );
    expect(actionButtons.length).toBe(0);

    // Modal onRequestClose should actively trap back button with a no-op handler without dismissing
    const modal = root.findByType(Modal);
    expect(typeof modal.props.onRequestClose).toBe('function');
    act(() => {
      modal.props.onRequestClose();
    });
    // Modal remains in downloading state
    const downloadingNodes = root.findAllByType(RNText);
    const downloadingText = downloadingNodes.map((n) => n.props.children).flat().join(' ');
    expect(downloadingText).toContain('Downloading update...');

    // Clean up unresolved promise
    if (resolveFetch) {
      await act(async () => {
        resolveFetch!();
      });
    }
  });

  it('silently dismisses modal if fetchUpdateAsync resolves with isNew: false', async () => {
    const checkForUpdatesFn = jest.fn(async () => otaDescriptor);
    const fetchUpdateFn = jest.fn(
      async () => ({ isNew: false, manifest: {} } as unknown as Updates.UpdateFetchResult)
    );
    const reloadFn = jest.fn(async () => undefined);

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <UpdatePrompt
          checkDelayMs={0}
          minDownloadDurationMs={0}
          checkForUpdatesFn={checkForUpdatesFn}
          fetchUpdateFn={fetchUpdateFn}
          reloadFn={reloadFn}
        />
      );
    });

    const root = testRenderer!.root;
    const updateNowButton = root.findAll((n) => n.props?.title === 'Update now')[0];

    await act(async () => {
      await updateNowButton.props.onPress();
    });

    expect(reloadFn).not.toHaveBeenCalled();
    expect(root.children.length).toBe(0);
  });

  it('automatically transitions to Stage 2 once download finishes, showing Restart now and Restart later', async () => {
    const checkForUpdatesFn = jest.fn(async () => otaDescriptor);
    let resolveFetch: (() => void) | undefined;
    const fetchUpdateFn = jest.fn(
      () =>
        new Promise<Updates.UpdateFetchResult>((resolve) => {
          resolveFetch = () => resolve({ isNew: true, manifest: {} } as Updates.UpdateFetchResult);
        })
    );
    const reloadFn = jest.fn(async () => undefined);

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <UpdatePrompt
          checkDelayMs={0}
          minDownloadDurationMs={0}
          checkForUpdatesFn={checkForUpdatesFn}
          fetchUpdateFn={fetchUpdateFn}
          reloadFn={reloadFn}
        />
      );
    });

    const root = testRenderer!.root;
    const updateNowButton = root.findAll((n) => n.props?.title === 'Update now')[0];

    // Trigger download
    act(() => {
      void updateNowButton.props.onPress();
    });

    // Complete download
    await act(async () => {
      resolveFetch!();
    });

    // Now in Stage 2
    const textNodes = root.findAllByType(RNText);
    const allText = textNodes.map((n) => n.props.children).flat().join(' ');
    expect(allText).toContain('Update ready');
    expect(allText).toContain('Restart now to apply changes?');
    expect(allText).toContain('Restart now');
    expect(allText).toContain('Restart later');

    // Tapping Restart now calls reloadFn
    const restartNowButton = root.findAll((n) => n.props?.title === 'Restart now')[0];
    await act(async () => {
      await restartNowButton.props.onPress();
    });
    expect(reloadFn).toHaveBeenCalledTimes(1);
  });

  it('tapping Restart later in Stage 2 dismisses the modal', async () => {
    const checkForUpdatesFn = jest.fn(async () => otaDescriptor);
    const fetchUpdateFn = jest.fn(async () => ({ isNew: true, manifest: {} } as Updates.UpdateFetchResult));
    const reloadFn = jest.fn(async () => undefined);

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <UpdatePrompt
          checkDelayMs={0}
          minDownloadDurationMs={0}
          checkForUpdatesFn={checkForUpdatesFn}
          fetchUpdateFn={fetchUpdateFn}
          reloadFn={reloadFn}
        />
      );
    });

    const root = testRenderer!.root;
    const updateNowButton = root.findAll((n) => n.props?.title === 'Update now')[0];

    // Trigger update and wait for download to finish
    await act(async () => {
      await updateNowButton.props.onPress();
    });

    // Stage 2
    const restartLaterButton = root.findAll((n) => n.props?.title === 'Restart later')[0];
    await act(async () => {
      await restartLaterButton.props.onPress();
    });

    expect(reloadFn).not.toHaveBeenCalled();

    const modals = root.findAllByType(Modal);
    if (modals.length > 0) {
      expect(modals[0].props.visible).toBe(false);
    } else {
      expect(root.children.length).toBe(0);
    }
  });
});

describe('UpdatePrompt - No-Op & Error Resilience (Seam 3)', () => {
  it('remains hidden when checkForUpdates returns type "none"', async () => {
    const checkForUpdatesFn = jest.fn(async () => ({ type: 'none' as const }));

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <UpdatePrompt
          checkDelayMs={0}
          checkForUpdatesFn={checkForUpdatesFn}
        />
      );
    });

    const root = testRenderer!.root;
    expect(checkForUpdatesFn).toHaveBeenCalledTimes(1);
    expect(root.children.length).toBe(0);
  });

  it('fails silently and remains hidden when checkForUpdates throws an error', async () => {
    const checkForUpdatesFn = jest.fn(async () => {
      throw new Error('Network error or rate limited');
    });

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <UpdatePrompt
          checkDelayMs={0}
          checkForUpdatesFn={checkForUpdatesFn}
        />
      );
    });

    const root = testRenderer!.root;
    expect(checkForUpdatesFn).toHaveBeenCalledTimes(1);
    expect(root.children.length).toBe(0);
  });

  it('silently dismisses modal if OTA download fails during downloading state', async () => {
    const otaDescriptor: UpdateCheckResult = {
      type: 'ota',
      manifest: { id: 'update-fail', createdAt: '2026-11-11' } as never,
    };
    const checkForUpdatesFn = jest.fn(async () => otaDescriptor);
    const fetchUpdateFn = jest.fn(async () => {
      throw new Error('OTA download bundle fetch failed');
    });

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <UpdatePrompt
          checkDelayMs={0}
          minDownloadDurationMs={0}
          checkForUpdatesFn={checkForUpdatesFn}
          fetchUpdateFn={fetchUpdateFn}
        />
      );
    });

    const root = testRenderer!.root;
    const updateNowButton = root.findAll((n) => n.props?.title === 'Update now')[0];

    await act(async () => {
      await updateNowButton.props.onPress();
    });

    // Should return to idle / hidden
    expect(root.children.length).toBe(0);
  });

  it('enforces minDownloadDurationMs buffering duration before transitioning to Stage 2', async () => {
    const otaDescriptor: UpdateCheckResult = {
      type: 'ota',
      manifest: { id: 'update-delay-test', createdAt: '2026-11-12' } as never,
    };
    const checkForUpdatesFn = jest.fn(async () => otaDescriptor);
    // Instant download
    const fetchUpdateFn = jest.fn(async () => ({ isNew: true, manifest: {} } as Updates.UpdateFetchResult));

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <UpdatePrompt
          checkDelayMs={0}
          minDownloadDurationMs={80}
          checkForUpdatesFn={checkForUpdatesFn}
          fetchUpdateFn={fetchUpdateFn}
        />
      );
    });

    const root = testRenderer!.root;
    const updateNowButton = root.findAll((n) => n.props?.title === 'Update now')[0];

    // Trigger update
    act(() => {
      void updateNowButton.props.onPress();
    });

    // Check immediately: still downloading
    const textNodesImmediate = root.findAllByType(RNText);
    const textImmediate = textNodesImmediate.map((n) => n.props.children).flat().join(' ');
    expect(textImmediate).toContain('Downloading update...');

    // Wait past the minDownloadDurationMs threshold
    await act(async () => {
      await new Promise((res) => setTimeout(res, 120));
    });

    // Now transitioned to Stage 2
    const textNodesAfter = root.findAllByType(RNText);
    const textAfter = textNodesAfter.map((n) => n.props.children).flat().join(' ');
    expect(textAfter).toContain('Update ready');
  });

  it('enforces minDownloadDurationMs buffering duration even when OTA download fails', async () => {
    const otaDescriptor: UpdateCheckResult = {
      type: 'ota',
      manifest: { id: 'update-fail-delay', createdAt: '2026-11-12' } as never,
    };
    const checkForUpdatesFn = jest.fn(async () => otaDescriptor);
    // Immediate failure
    const fetchUpdateFn = jest.fn(async () => {
      throw new Error('Immediate download failure');
    });

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <UpdatePrompt
          checkDelayMs={0}
          minDownloadDurationMs={80}
          checkForUpdatesFn={checkForUpdatesFn}
          fetchUpdateFn={fetchUpdateFn}
        />
      );
    });

    const root = testRenderer!.root;
    const updateNowButton = root.findAll((n) => n.props?.title === 'Update now')[0];

    // Trigger update
    act(() => {
      void updateNowButton.props.onPress();
    });

    // Modal is still showing downloading spinner during the window
    const textNodesImmediate = root.findAllByType(RNText);
    const textImmediate = textNodesImmediate.map((n) => n.props.children).flat().join(' ');
    expect(textImmediate).toContain('Downloading update...');

    // Wait past the minDownloadDurationMs threshold
    await act(async () => {
      await new Promise((res) => setTimeout(res, 120));
    });

    // Now dismissed to idle
    expect(root.children.length).toBe(0);
  });
});
