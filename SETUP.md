# CI/CD Pipeline Setup Guide

This guide walks you through setting up the automated CI/CD pipeline for your Money Manager Expo app. Once configured, every PR merge to `main` will automatically trigger either an OTA update (for JS changes) or a full native APK build (for native module changes).

## Prerequisites

- A GitHub account with username `Techkilladis`
- EAS CLI installed and logged in with the account that owns the project
- Node.js 18+ and Bun or npm installed

---

## Step 1: Create the GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Enter repository name: `MoneyManagerExpo52`
3. Set it to **Public** (the workflow is designed for public repos)
4. **Do not** initialize with README, `.gitignore`, or license — you already have these locally
5. Click **Create repository**

---

## Step 2: Connect Your Local Git Repository

```bash
# Add the remote origin (replace <TOKEN> if using a personal access token)
git remote add origin https://github.com/Techkilladis/MoneyManagerExpo52.git

# Verify the remote
git remote -v

# Push all branches to the new remote
git push -u origin main
```

If you don't have a `main` branch yet:

```bash
git branch -M main
git push -u origin main
```

---

## Step 3: Create an EAS API Key for CI

You need a dedicated API key that the GitHub Actions workflow will use to authenticate with EAS. This key can be revoked independently if compromised.

```bash
# Run this on your local machine where you're already logged in to EAS
eas api-keys:create --project-id 794dc62b-... --kind token
```

> Replace `794dc62b-...` with your actual EAS project ID.

This command outputs an **access token** (a long string). **Copy it immediately** — you won't see it again.

---

## Step 4: Add the EAS API Key as a GitHub Secret

1. Go to your repository settings: `https://github.com/Techkilladis/MoneyManagerExpo52/settings/secrets/actions`
2. Click **New repository secret**
3. Name: `EAS_ACCESS_TOKEN`
4. Value: Paste the EAS access token from Step 3
5. Click **Add secret**

---

## Step 5: (Optional) Create a GitHub Deploy Token for Release Uploads

The workflow creates GitHub Releases with APK attachments. The `contents: write` permission on the workflow's GITHUB_TOKEN is sufficient for this — no additional token is required.

---

## Step 6: Push All Files to the Repository

Ensure all files are staged and committed:

```bash
# Stage all files
git add .

# Commit with a descriptive message
git commit -m "feat: add automated CI/CD pipeline setup"

# Push to main
git push origin main
```

The key files that must be in your repository:

| File | Purpose |
|------|---------|
| `.github/workflows/ci-cd.yml` | GitHub Actions workflow — the core automation |
| `src/services/updateChecker.ts` | App-side service for checking OTA updates |
| `src/components/UpdatePrompt.tsx` | UI component showing "Update available" prompt |
| `app.json` | EAS project configuration |
| `eas.json` | EAS build profiles |

---

## Step 7: Integrate UpdatePrompt into Your App

Open [`app/_layout.tsx`](app/_layout.tsx) and add the `UpdatePrompt` component inside your root layout:

```tsx
import { UpdatePrompt } from '@/components/UpdatePrompt';

export default function RootLayout() {
  return (
    <>
      {/* ... your existing layout content ... */}
      <UpdatePrompt />
    </>
  );
}
```

This ensures every screen gets the update prompt when a new OTA update is available.

---

## Step 8: (Optional) Add Update Preference Setting

If you want users to toggle between auto-update and manual prompt, add a settings screen with this logic:

```tsx
import { getSetting, setSetting } from '@/services/settings';

const AUTO_UPDATE_KEY = 'updatePreference' as const;

async function loadAutoUpdate(): Promise<boolean> {
  return (await getSetting(AUTO_UPDATE_KEY)) ?? false;
}

async function setAutoUpdate(value: boolean): Promise<void> {
  await setSetting(AUTO_UPDATE_KEY, value);
}
```

Then pass the `autoUpdate` flag to your app logic to decide whether to auto-apply updates or show the prompt.

---

## Step 9: Test the Workflow

### Create a Test PR

1. Create a new branch:
   ```bash
   git checkout -b test/ci-cd-pipeline
   ```

2. Make a small change (e.g., edit `README.md` or add a console.log in a JS file)

3. Commit and push:
   ```bash
   git add .
   git commit -m "test: verify CI/CD pipeline"
   git push origin test/ci-cd-pipeline
   ```

4. Create a Pull Request on GitHub:
   - Go to `https://github.com/Techkilladis/MoneyManagerExpo52/pulls`
   - Click **New Pull Request**
   - Select `test/ci-cd-pipeline` → `main`
   - Give it a title like "Test: Verify CI/CD Pipeline"
   - Click **Create Pull Request**

5. Merge the PR (you can use "Merge commit", "Squash and merge", or "Rebase and merge")

### Check the Workflow Run

After merging, navigate to the **Actions** tab: `https://github.com/Techkilladis/MoneyManagerExpo52/actions`

You should see a workflow run triggered by the PR merge. It will:

1. **Detect changes** — Since you only changed JS files, it will trigger an OTA update
2. **OTA Update job** — Publish the update to the `production` channel via `eas update`
3. **Post a PR comment** — Notify you that the OTA update was successful

### Test Native Build Detection

To test the native build path:

1. Create another PR with a change to a native file (e.g., edit `app.json`, `eas.json`, or any file in `modules/notification-detection/`)
2. Merge the PR
3. The workflow will trigger a full Android APK build via `eas build`
4. After the build completes (~15-30 minutes on EAS Free), it will:
   - Upload the APK as a GitHub Release artifact
   - Create a GitHub Release with the APK attached
   - Post a PR comment with the download link

---

## Step 10: Verify OTA Updates on Device

Once the workflow publishes an OTA update:

1. Open your app on a friend's device
2. The `UpdatePrompt` component will check for updates
3. If an update is available, a bottom sheet dialog appears:
   - **"Later"** — Dismisses the prompt, user continues using the current version
   - **"Update & Restart"** — Downloads and applies the update, restarting the app

---

## Troubleshooting

### Workflow Fails at EAS Login

- Verify `EAS_ACCESS_TOKEN` secret is set correctly in your repository settings
- Ensure the token belongs to the account that owns the EAS project
- Regenerate the token if it was revoked or expired

### OTA Update Doesn't Reach Friends

- Ensure `expo-updates` is installed and configured in your app
- Check that the `production` channel is set correctly in `app.json`
- OTA updates only apply to JS/TS changes — native module changes require a full rebuild

### Native Build Fails

- Check the workflow logs on the **Actions** tab for build errors
- Ensure all native dependencies are compatible with your Expo SDK version
- The daily native build cap limits you to 1 build per day on the EAS Free plan

### UpdatePrompt Doesn't Show

- Verify you added `<UpdatePrompt />` to `app/_layout.tsx`
- Check that `src/services/updateChecker.ts` is correctly importing from `expo-updates` and `expo-application`
- Ensure the app has network connectivity to reach the Expo CDN

---

## Maintenance

### Daily Native Build Cap

The workflow enforces a cap of 1 native build per calendar day using a simple shell cache. This protects your EAS Free plan quota (50 builds/month). If you need more builds, consider upgrading to the Pro plan.

### Revoking the CI API Key

If the `EAS_ACCESS_TOKEN` secret is compromised:

1. Go to [EAS Dashboard](https://expo.dev/)
2. Navigate to **Settings** → **API Keys**
3. Find the CI key and click **Revoke**
4. Generate a new key following Step 3
5. Update the `EAS_ACCESS_TOKEN` secret in your GitHub repository

---

## Next Steps

- [ ] Publish to Google Play Store (see `eas submit` documentation)
- [ ] Add auto-update toggle in settings UI
- [ ] Configure email/slack notifications for workflow failures
- [ ] Add staging/test environment for pre-production testing
