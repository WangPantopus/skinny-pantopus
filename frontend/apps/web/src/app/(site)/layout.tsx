import './site.css';

// Every page in this group loads the full stylesheet on top of src/app/globals.css. The homepage, the sign-in pages,
// not-found and error sit outside the group, so they block only on that light one. A route group: URLs are unchanged.
export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
