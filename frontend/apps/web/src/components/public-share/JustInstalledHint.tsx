// The App Store and Google Play open a newly installed app on its first screen. Getting the app from this page
// keeps the link: Google Play hands it to the Android app on its first launch, and on an iPhone the page copies it
// for the app's Paste button. An email invitation also finds its person when they sign up with the address it went
// to. Anywhere else (a computer), the person comes back to the page once they have the app.
export default function JustInstalledHint({
  what,
  emailHint = null,
  platform = null,
}: {
  what: string;
  emailHint?: string | null;
  platform?: 'ios' | 'android' | null;
}) {
  let text: string;
  if (emailHint) {
    const signUp = `New to Pantopus? Sign up with ${emailHint}, the address this invitation went to, and ${what} opens for you.`;
    text =
      platform === 'ios'
        ? `${signUp} If you get the app from this page, tap Paste when it opens.`
        : platform === 'android'
          ? `${signUp} If you get the app from this page, ${what} opens when you start it.`
          : `${signUp} Or come back to this page and tap Open in Pantopus.`;
  } else {
    text =
      platform === 'ios'
        ? `New to Pantopus? Get the app from this page, then tap Paste when it opens to see ${what}.`
        : platform === 'android'
          ? `New to Pantopus? Get the app from this page, and ${what} opens when you start it.`
          : `Just installed Pantopus? Come back to this page and tap Open in Pantopus to see ${what}.`;
  }
  return <p className="text-center text-xs leading-4 text-app-text-secondary">{text}</p>;
}
