import Link from 'next/link';
import { PantopusMark } from '@/components/brand/PantopusMark';
import styles from './home.module.css';

// Only pages that are live: nothing here links into a switched-off feature.
const COLUMNS = [
  {
    head: 'Explore',
    links: [
      { href: '/start', label: 'See your place' },
      { href: '#how-it-works', label: 'How it works' },
      { href: '#plans', label: 'Plans' },
      { href: '/login', label: 'Sign in' },
    ],
  },
  {
    head: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    head: 'Trust',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/child-safety', label: 'Child Safety' },
      { href: '/delete-account', label: 'Delete account' },
    ],
  },
];

export default function HomeFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: 'var(--night-ink)' }}>
            <PantopusMark size={22} variant="reverse" />
            <span className={styles.brandWord} style={{ fontSize: 20 }}>Pantopus</span>
          </span>
          <span>Your home, your everyday, and the life around you.</span>
          <span style={{ fontSize: 13, color: '#7E8BA0' }}>© 2026 Pantopus, Inc.</span>
        </div>
        <nav className={styles.footerCols} aria-label="Footer">
          {COLUMNS.map((col) => (
            <div key={col.head} className={styles.footerCol}>
              <span className={styles.footerHead}>{col.head}</span>
              {col.links.map((l) =>
                l.href.startsWith('#') ? (
                  <a key={l.href} href={l.href}>{l.label}</a>
                ) : (
                  <Link key={l.href} href={l.href}>{l.label}</Link>
                ),
              )}
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}
