// Every 404 (an unknown profile name, post or address) gets the profile page's "not found" look and a
// way back. "/" takes signed-in people to their Place and everyone else to the landing page.
export default function NotFound() {
  return (
    <div className="min-h-screen bg-app flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-app mb-2">Page not found</h1>
        <p className="text-app-secondary mb-4">This page doesn&apos;t exist or has been removed.</p>
        {/* This root fallback is included in every route's server payload. A
            client Link reference here also pulls the homepage's client chunks
            into healthy pages. A normal navigation needs no client boundary
            and still lets middleware choose Place or the public homepage. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="inline-block bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
        >
          Go to Pantopus
        </a>
      </div>
    </div>
  );
}
