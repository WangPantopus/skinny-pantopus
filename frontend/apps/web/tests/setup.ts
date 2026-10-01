import '@testing-library/jest-dom';

// The first-launch cut (src/lib/featureFlags.ts) hides eight features unless
// NEXT_PUBLIC_LAUNCH_FEATURES lists them. Their code and tests stay, so the
// suite runs with every feature on.
process.env.NEXT_PUBLIC_LAUNCH_FEATURES = process.env.NEXT_PUBLIC_LAUNCH_FEATURES ?? 'all';
