// The App Store and Google Play open a newly installed app on its first screen: the
// link someone was sent doesn't survive the install. Tell them to come back for it. An
// email invitation also finds its person when they sign up with the address it went to.
export default function JustInstalledHint({ what, emailHint = null }: { what: string; emailHint?: string | null }) {
  if (emailHint) {
    return (
      <p className="text-center text-xs leading-4 text-app-text-secondary">
        New to Pantopus? Sign up with {emailHint}, the address this invitation went to, and {what} opens for you. Or come
        back to this page and tap Open in Pantopus.
      </p>
    );
  }
  return (
    <p className="text-center text-xs leading-4 text-app-text-secondary">
      Just installed Pantopus? Come back to this page and tap Open in Pantopus to see {what}.
    </p>
  );
}
