// Decisions made once at startup, read synchronously by layouts.
export const session = {
  /** First run with no data of the user's own: show onboarding. */
  needsOnboarding: false,
};
