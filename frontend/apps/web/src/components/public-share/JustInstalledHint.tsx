// The App Store and Google Play open a newly installed app on its first screen: the
// link someone was sent doesn't survive the install. Tell them to come back for it.
export default function JustInstalledHint({ what }: { what: string }) {
  return (
    <p className="text-center text-xs leading-4 text-app-text-secondary">
      Just installed Pantopus? Come back to this page and tap Open in Pantopus to see {what}.
    </p>
  );
}
