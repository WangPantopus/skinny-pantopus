// The app shell's line to chat's device code, which the root layout loads
// (lib/query-provider.tsx, components/chat/chatDevice.ts): the shell says who is
// signed in, and when it navigates, without loading that code a second time.
type ChatShell = { signedIn: (userId: string) => (() => void) | undefined; navigated: () => void };
let shell: ChatShell | null = null;

export function setChatShell(next: ChatShell): void { shell = next; }

/** Returns the cleanup for the shell's effect. */
export function chatShellSignedIn(userId: string): (() => void) | undefined { return shell?.signedIn(userId); }

export function chatShellNavigated(): void { shell?.navigated(); }
