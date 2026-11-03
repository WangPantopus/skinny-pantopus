import type { ReactNode } from 'react';
import { Globe, Link2, Mail, Phone, ShieldCheck } from 'lucide-react';

const LINK_LABELS: Array<[key: string, label: string]> = [
  ['website', 'Website'],
  ['linkedin', 'LinkedIn'],
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['twitter', 'X (Twitter)'],
];

/** A link the person added, as an https address; anything that isn't a web address is left out. */
function safeLink(value: unknown): URL | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

function shortLink(url: URL): string {
  const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
  return `${url.hostname.replace(/^www\./, '')}${path}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-[1.0625rem] leading-[1.375rem] font-semibold text-app">{title}</h3>
      {children}
    </section>
  );
}

function Row({ icon, iconClassName, title, detail }: { icon: ReactNode; iconClassName: string; title: ReactNode; detail?: string }) {
  return (
    <div className="min-h-[3.5rem] px-4 py-3 flex items-center gap-3">
      <span aria-hidden="true" className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${iconClassName}`}>{icon}</span>
      <div className="min-w-0 flex flex-col gap-0.5">
        <span className="text-[0.9375rem] leading-5 font-semibold text-app [overflow-wrap:anywhere]">{title}</span>
        {detail ? <span className="text-[0.8125rem] leading-[1.125rem] text-app-muted">{detail}</span> : null}
      </div>
    </div>
  );
}

interface AboutTabProps {
  firstName: string;
  skills: string[];
  /** A verified home, as the read gives it to this viewer. */
  verifiedNeighbor: boolean;
  city?: string | null;
  /** The account's email is confirmed. */
  emailConfirmed: boolean;
  socialLinks?: Record<string, unknown> | null;
  /** The email and phone the person chose to show on their profile ("Show on my profile" in Edit profile). */
  contact?: { email?: string | null; phone?: string | null };
  /** A skill's action while Open Gigs is on (a hire request); without one the skills are plain chips. */
  onSkill?: () => void;
  /** Sections the profile adds later (Around the neighborhood), after Helps with. */
  children?: ReactNode;
}

/**
 * About: what the person helps with, what Pantopus has verified in plain words, and their links. Never the bio again:
 * it is at the top of the page.
 */
export default function AboutTab({
  firstName,
  skills,
  verifiedNeighbor,
  city = null,
  emailConfirmed,
  socialLinks = null,
  contact,
  onSkill,
  children,
}: AboutTabProps) {
  const links = LINK_LABELS
    .map(([key, label]) => ({ key, label, url: safeLink(socialLinks?.[key]) }))
    .filter((link): link is { key: string; label: string; url: URL } => link.url !== null);
  const anyVerified = verifiedNeighbor || emailConfirmed;
  const email = contact?.email?.trim() || null;
  const phone = contact?.phone?.trim() || null;
  const empty = skills.length === 0 && !anyVerified && links.length === 0 && !email && !phone && !children;

  if (empty) {
    return (
      <p className="py-8 text-center text-[0.9375rem] leading-5 text-app-muted">
        {firstName} hasn&apos;t added anything here yet.
      </p>
    );
  }

  const chip = 'px-3.5 py-[0.4375rem] rounded-full border border-app bg-surface text-[0.9375rem] leading-5 text-app-strong';

  return (
    <div className="flex flex-col gap-6">
      {skills.length > 0 && (
        <Section title="Helps with">
          <ul className="flex flex-wrap gap-2">
            {skills.map((skill, index) => (
              <li key={`${skill}-${index}`}>
                {onSkill ? (
                  <button type="button" onClick={onSkill} className={`${chip} min-h-[2.75rem] hover-bg-app`}>{skill}</button>
                ) : (
                  <span className={`${chip} inline-block`}>{skill}</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {children}

      {anyVerified && (
        <Section title="Verified">
          <div className="rounded-2xl border border-app bg-surface divide-y divide-app overflow-hidden">
            {verifiedNeighbor && (
              <Row
                icon={<ShieldCheck className="w-[1.0625rem] h-[1.0625rem]" />}
                iconClassName="bg-app-home-bg text-app-home"
                title={city ? `Lives in ${city}` : 'Verified neighbor'}
                detail="Pantopus confirmed where they live. The address itself is never shown."
              />
            )}
            {emailConfirmed && (
              <Row
                icon={<Mail className="w-[1.0625rem] h-[1.0625rem]" />}
                iconClassName="bg-app-surface-sunken text-app-secondary"
                title="Email confirmed"
              />
            )}
          </div>
        </Section>
      )}

      {(email || phone) && (
        <Section title="Contact">
          <ul className="rounded-2xl border border-app bg-surface divide-y divide-app overflow-hidden">
            {email ? (
              <li>
                <a href={`mailto:${email}`} className="min-h-[3.5rem] px-4 py-3 flex items-center gap-3 hover-bg-app">
                  <span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-full bg-app-surface-sunken text-app-secondary flex items-center justify-center">
                    <Mail className="w-[1.0625rem] h-[1.0625rem]" />
                  </span>
                  <span className="min-w-0 flex flex-col gap-0.5">
                    <span className="text-[0.9375rem] leading-5 font-semibold text-app">Email</span>
                    <span className="text-[0.8125rem] leading-[1.125rem] text-app-link [overflow-wrap:anywhere]">{email}</span>
                  </span>
                </a>
              </li>
            ) : null}
            {phone ? (
              <li>
                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="min-h-[3.5rem] px-4 py-3 flex items-center gap-3 hover-bg-app">
                  <span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-full bg-app-surface-sunken text-app-secondary flex items-center justify-center">
                    <Phone className="w-[1.0625rem] h-[1.0625rem]" />
                  </span>
                  <span className="min-w-0 flex flex-col gap-0.5">
                    <span className="text-[0.9375rem] leading-5 font-semibold text-app">Phone</span>
                    <span className="text-[0.8125rem] leading-[1.125rem] text-app-link">{phone}</span>
                  </span>
                </a>
              </li>
            ) : null}
          </ul>
        </Section>
      )}

      {links.length > 0 && (
        <Section title="Links">
          <ul className="rounded-2xl border border-app bg-surface divide-y divide-app overflow-hidden">
            {links.map(({ key, label, url }) => (
              <li key={key}>
                <a
                  href={url.toString()}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  className="min-h-[3.5rem] px-4 py-3 flex items-center gap-3 hover-bg-app"
                >
                  <span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-full bg-app-surface-sunken text-app-secondary flex items-center justify-center">
                    {key === 'website' ? <Globe className="w-[1.0625rem] h-[1.0625rem]" /> : <Link2 className="w-[1.0625rem] h-[1.0625rem]" />}
                  </span>
                  <span className="min-w-0 flex flex-col gap-0.5">
                    <span className="text-[0.9375rem] leading-5 font-semibold text-app">{label}</span>
                    <span className="text-[0.8125rem] leading-[1.125rem] text-app-link [overflow-wrap:anywhere]">{shortLink(url)}</span>
                  </span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
