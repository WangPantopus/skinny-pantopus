// A19.1 — Privacy Policy
// Archetype: A19 Legal / static · variant: long-form legal document
// Two frames: (1) entry state — top of doc, TOC expanded
//             (2) mid-scroll state — back-to-top visible, TOC collapsed/scrolled away

const LG = {
  primary600:'#0284c7', primary50:'#f0f9ff', primary100:'#e0f2fe', primary700:'#0369a1',
  fg1:'#111827', fg2:'#374151', fg3:'#6b7280', fg4:'#9ca3af',
  surface:'#ffffff', sunken:'#f3f4f6', muted:'#f8fafc',
  border:'#e5e7eb', borderSub:'#f3f4f6', borderStrong:'#d1d5db',
};

// ─── Phone shell + status bar ─────────────────────────────────
function LGSB({ color = LG.fg1 }) {
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'16px 28px 0', height:44, boxSizing:'border-box',
      fontFamily:'-apple-system, system-ui', fontWeight:600, fontSize:15, color,
      flexShrink:0, position:'relative', zIndex:5,
    }}>
      <span>9:41</span>
      <div style={{display:'flex', gap:5, alignItems:'center'}}>
        <svg width="17" height="11" viewBox="0 0 17 11">
          <rect x="0" y="7" width="3" height="4" rx="0.6" fill={color}/>
          <rect x="4.5" y="4.5" width="3" height="6.5" rx="0.6" fill={color}/>
          <rect x="9" y="2" width="3" height="9" rx="0.6" fill={color}/>
          <rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={color}/>
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11">
          <path d="M7.5 3C9.5 3 11.3 3.8 12.6 5l1-1C12 2.4 9.9 1.5 7.5 1.5S3 2.4 1.4 4l1 1C3.7 3.8 5.5 3 7.5 3z" fill={color}/>
          <path d="M7.5 6c1.2 0 2.2.4 3 1.1l1-1C10.3 5.1 9 4.5 7.5 4.5S4.7 5.1 3.5 6.1l1 1C5.3 6.4 6.3 6 7.5 6z" fill={color}/>
          <circle cx="7.5" cy="9" r="1.3" fill={color}/>
        </svg>
        <svg width="24" height="11" viewBox="0 0 24 11">
          <rect x="0.5" y="0.5" width="21" height="10" rx="3" stroke={color} strokeOpacity="0.45" fill="none"/>
          <rect x="2" y="2" width="17" height="7" rx="1.5" fill={color}/>
        </svg>
      </div>
    </div>
  );
}

function LGPhone({ children }) {
  return (
    <div style={{
      width:360, height:740, borderRadius:46, padding:10, background:'#0b0f17',
      boxShadow:'0 40px 80px rgba(17,24,39,0.22), 0 0 0 1px rgba(0,0,0,0.14)',
    }}>
      <div style={{
        width:'100%', height:'100%', background:LG.surface,
        borderRadius:36, overflow:'hidden', position:'relative',
        display:'flex', flexDirection:'column',
        fontFamily:'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          position:'absolute', top:9, left:'50%', transform:'translateX(-50%)',
          width:108, height:30, borderRadius:20, background:'#000', zIndex:50,
        }}/>
        <LGSB color={LG.fg1}/>
        {children}
        <div style={{
          position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)',
          width:120, height:4, borderRadius:4,
          background:'rgba(0,0,0,0.35)', zIndex:60,
        }}/>
      </div>
    </div>
  );
}

// ─── Top bar — back + title + share ───────────────────────────
function LGTopBar({ title }) {
  return (
    <div style={{
      padding:'6px 10px', boxSizing:'border-box', height:52,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      background:LG.surface, flexShrink:0,
      borderBottom:`1px solid ${LG.border}`,
      position:'relative',
    }}>
      <button style={{
        width:36, height:36, borderRadius:'50%', background:'transparent',
        border:'none', cursor:'pointer', color:LG.fg1,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i data-lucide="chevron-left" style={{width:22, height:22, strokeWidth:2.2}}/>
      </button>
      <span style={{
        fontSize:15, fontWeight:700, color:LG.fg1, letterSpacing:-0.15,
        position:'absolute', left:'50%', transform:'translateX(-50%)',
      }}>{title}</span>
      <button style={{
        width:36, height:36, borderRadius:'50%', background:'transparent',
        border:'none', cursor:'pointer', color:LG.fg1,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i data-lucide="share" style={{width:18, height:18, strokeWidth:2}}/>
      </button>
    </div>
  );
}

// ─── Meta strip ───────────────────────────────────────────────
function MetaStrip({ updated, version }) {
  return (
    <div style={{
      flexShrink:0,
      padding:'9px 20px',
      background:LG.sunken,
      borderBottom:`1px solid ${LG.border}`,
      fontSize:11, color:LG.fg3, fontWeight:500, letterSpacing:-0.02,
      display:'flex', alignItems:'center', gap:6,
    }}>
      <i data-lucide="clock" style={{width:11, height:11, strokeWidth:2, color:LG.fg4}}/>
      <span>Last updated: <strong style={{color:LG.fg2, fontWeight:600}}>{updated}</strong></span>
      <span style={{color:LG.fg4}}>·</span>
      <span>Version <strong style={{color:LG.fg2, fontWeight:600}}>{version}</strong></span>
    </div>
  );
}

// ─── Collapsible TOC card ─────────────────────────────────────
function TOCCard({ items, open, onToggle }) {
  return (
    <div style={{
      background:LG.surface, border:`1px solid ${LG.border}`,
      borderRadius:12, overflow:'hidden',
      boxShadow:'0 1px 2px rgba(17,24,39,0.04)',
    }}>
      <button onClick={onToggle} style={{
        width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'12px 14px', background:'transparent', border:'none', cursor:'pointer',
        textAlign:'left',
      }}>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:8,
          fontSize:13, fontWeight:700, color:LG.fg1, letterSpacing:-0.05,
        }}>
          <i data-lucide="list" style={{width:14, height:14, strokeWidth:2.2, color:LG.primary600}}/>
          Jump to section
        </span>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:8,
        }}>
          {!open && (
            <span style={{
              fontSize:11, color:LG.fg3, fontWeight:500, letterSpacing:-0.02,
            }}>{items.length} sections</span>
          )}
          <i data-lucide={open ? 'chevron-up' : 'chevron-down'}
            style={{width:16, height:16, strokeWidth:2, color:LG.fg3}}/>
        </span>
      </button>
      {open && (
        <div style={{
          borderTop:`1px solid ${LG.borderSub}`,
          padding:'4px 0 6px',
        }}>
          {items.map((it, i) => (
            <a key={i} href={`#sec-${i+1}`} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'9px 14px', textDecoration:'none',
              borderBottom: i < items.length - 1 ? `1px solid ${LG.borderSub}` : 'none',
            }}>
              <span style={{
                width:22, height:22, borderRadius:6,
                background:LG.primary50, color:LG.primary700,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10.5, fontWeight:700, letterSpacing:0,
                flexShrink:0,
              }}>{String(i+1).padStart(2, '0')}</span>
              <span style={{
                fontSize:12.5, color:LG.fg2, fontWeight:500,
                letterSpacing:-0.02, flex:1,
              }}>{it}</span>
              <i data-lucide="chevron-right" style={{width:13, height:13, color:LG.fg4, strokeWidth:2}}/>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section heading (H2) ─────────────────────────────────────
function H2({ n, children }) {
  return (
    <h2 id={`sec-${n}`} style={{
      margin:'28px 0 10px', fontSize:18, fontWeight:700,
      color:LG.primary700, letterSpacing:-0.2, lineHeight:'24px',
      display:'flex', alignItems:'baseline', gap:8,
    }}>
      <span style={{
        fontSize:11, fontWeight:700, color:LG.primary600,
        fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
        letterSpacing:0.04, paddingTop:2,
      }}>{String(n).padStart(2,'0')}</span>
      <span>{children}</span>
    </h2>
  );
}

function H3({ children }) {
  return (
    <h3 style={{
      margin:'18px 0 6px', fontSize:14.5, fontWeight:700,
      color:LG.fg1, letterSpacing:-0.1, lineHeight:'20px',
    }}>{children}</h3>
  );
}

function P({ children }) {
  return (
    <p style={{
      margin:'0 0 12px', fontSize:14, color:LG.fg1,
      lineHeight:'22px', letterSpacing:-0.02,
      textWrap:'pretty',
    }}>{children}</p>
  );
}

function DT({ children }) {
  // Defined term — bold fg1, no italics, no underline
  return <strong style={{fontWeight:700, color:LG.fg1}}>{children}</strong>;
}

function Bullets({ items }) {
  return (
    <ul style={{
      margin:'0 0 12px', padding:0, listStyle:'none',
      display:'flex', flexDirection:'column', gap:8,
    }}>
      {items.map((t, i) => (
        <li key={i} style={{display:'flex', gap:10, alignItems:'flex-start'}}>
          <span style={{
            width:5, height:5, borderRadius:'50%',
            background:LG.primary600, flexShrink:0,
            marginTop:8.5,
          }}/>
          <span style={{
            flex:1, fontSize:14, color:LG.fg1,
            lineHeight:'22px', letterSpacing:-0.02,
            textWrap:'pretty',
          }}>{t}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Footer contact card ──────────────────────────────────────
function ContactFooter({ email = 'privacy@pantopus.com', label = 'Questions about this policy?' }) {
  return (
    <a href={`mailto:${email}`} style={{
      display:'flex', alignItems:'center', gap:12,
      padding:'14px 16px', marginTop:28, marginBottom:8,
      background:LG.primary50, border:`1px solid ${LG.primary100}`,
      borderRadius:12, textDecoration:'none',
    }}>
      <div style={{
        width:36, height:36, borderRadius:'50%',
        background:'#fff', border:`1px solid ${LG.primary100}`,
        color:LG.primary600,
        display:'flex', alignItems:'center', justifyContent:'center',
        flexShrink:0,
      }}>
        <i data-lucide="mail" style={{width:16, height:16, strokeWidth:2}}/>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{
          fontSize:12.5, fontWeight:700, color:LG.fg1, letterSpacing:-0.05,
        }}>{label}</div>
        <div style={{
          fontSize:11.5, color:LG.primary700, fontWeight:600, marginTop:2,
          letterSpacing:-0.02,
        }}>{email}</div>
      </div>
      <i data-lucide="arrow-up-right" style={{
        width:16, height:16, color:LG.primary600, strokeWidth:2.2,
      }}/>
    </a>
  );
}

// ─── Back-to-top floating button ──────────────────────────────
function BackToTop({ visible, onClick }) {
  return (
    <button onClick={onClick} aria-label="Back to top" style={{
      position:'absolute', right:14, bottom:18,
      width:40, height:40, borderRadius:'50%',
      background:LG.sunken,
      border:`1px solid ${LG.border}`,
      color:LG.fg1, cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center',
      boxShadow:'0 6px 16px rgba(17,24,39,0.12), 0 1px 2px rgba(17,24,39,0.06)',
      transition:'opacity 0.18s, transform 0.18s',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(6px)',
      pointerEvents: visible ? 'auto' : 'none',
      zIndex:30,
    }}>
      <i data-lucide="arrow-up" style={{width:18, height:18, strokeWidth:2.2}}/>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// Shared body content for the Privacy Policy
// ═══════════════════════════════════════════════════════════════
const TOC_ITEMS = [
  'Overview',
  'Information we collect',
  'How we use it',
  'Identity pillars & privacy',
  'Sharing & disclosure',
  'Your rights & controls',
  'Data retention',
  'Children & teens',
  'International transfers',
  'Changes to this policy',
];

function PolicyBody() {
  return (
    <React.Fragment>
      <H2 n={1}>Overview</H2>
      <P>
        Pantopus is a neighborhood platform that lets you keep separate <DT>Personal</DT>, <DT>Home</DT>, and <DT>Business</DT> identities. This policy explains what data we collect for each pillar, why we collect it, and the controls you have over it.
      </P>
      <P>
        We wrote this in plain language. Defined terms appear in the Glossary at the end of the document.
      </P>

      <H2 n={2}>Information we collect</H2>
      <P>
        We collect three categories of information: information you give us directly, information generated by your use of Pantopus, and information from third parties (such as identity verification partners).
      </P>

      <H3>Information you provide</H3>
      <P>This includes account details, profile fields, content you post, and documents you upload to verify a claim:</P>
      <Bullets items={[
        'Your name, email address, and phone number',
        'Profile photos and avatars for each identity pillar',
        'Address and deed documents when claiming a Home identity',
        'Business filings, EIN, and storefront photos for a Business identity',
        'Messages you send through member chat and Ceremonial Mail',
      ]}/>

      <H3>Information generated by your use</H3>
      <P>
        We log device type, app version, approximate location (derived from IP), and which features you interact with. This helps us debug issues and tell you how busy your neighborhood is, without ever attaching precise GPS to your account.
      </P>

      <H2 n={3}>How we use it</H2>
      <P>
        We use the information above to operate Pantopus — for example, to deliver chat messages, route a package notification to the right <DT>Home</DT>, or surface a relevant local gig. We also use it for safety, fraud prevention, and to improve the product.
      </P>
      <Bullets items={[
        'To operate and maintain core features (chat, mail, claims)',
        'To verify identity claims and prevent impersonation',
        'To send transactional notifications you can control in Settings',
        'To improve and debug the product through aggregated analytics',
      ]}/>

      <H2 n={4}>Identity pillars & privacy</H2>
      <P>
        The three pillars are walled off from each other by default. Your <DT>Business</DT> identity does not show your home address; your <DT>Home</DT> identity does not reveal your personal phone number to neighbors unless you explicitly opt in.
      </P>
      <P>
        When someone sends you a <DT>Token</DT> (an invite to a Home, Business, or guest pass), the recipient sees only the fields you've published on that pillar — never the other two.
      </P>

      <H2 n={5}>Sharing & disclosure</H2>
      <P>
        We do not sell your personal information. We share data only with service providers under contract (hosting, payments, identity verification), with parties you direct us to share with, and when required by law.
      </P>

      <H2 n={6}>Your rights & controls</H2>
      <P>You can, at any time:</P>
      <Bullets items={[
        'Download a copy of your data from Settings → Privacy → Export',
        'Delete a single identity pillar or your entire account',
        'Revoke any Token you previously accepted',
        'Object to a specific use of your data by contacting privacy@pantopus.com',
      ]}/>

      <H2 n={7}>Data retention</H2>
      <P>
        We retain your data for as long as your account is active. When you delete an identity pillar, associated content is removed within 30 days. Some records (financial, safety) may be retained longer where legally required.
      </P>

      <H2 n={8}>Children & teens</H2>
      <P>
        Pantopus is intended for users 13 and older. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us so we can remove it.
      </P>

      <H2 n={9}>International transfers</H2>
      <P>
        We are based in the United States. If you use Pantopus from outside the U.S., your information will be transferred to, stored, and processed in the U.S. under appropriate safeguards.
      </P>

      <H2 n={10}>Changes to this policy</H2>
      <P>
        We may update this policy from time to time. When we do, we'll change the "Last updated" date at the top and — for material changes — send an in-app notice at least 14 days before the changes take effect.
      </P>

      <ContactFooter/>
    </React.Fragment>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 1 — POPULATED, TOP OF DOC, TOC EXPANDED
// ═══════════════════════════════════════════════════════════════
function FramePrivacyTop() {
  const [tocOpen, setTocOpen] = React.useState(true);
  const [showTop, setShowTop] = React.useState(false);
  const scrollerRef = React.useRef(null);

  const onScroll = (e) => setShowTop(e.target.scrollTop > 220);
  const scrollTop = () => scrollerRef.current?.scrollTo({top:0, behavior:'smooth'});

  React.useEffect(() => {
    const t = setTimeout(() => window.lucide && window.lucide.createIcons(), 30);
    return () => clearTimeout(t);
  });

  return (
    <LGPhone>
      <LGTopBar title="Privacy policy"/>
      <MetaStrip updated="October 1, 2025" version="3.2"/>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        style={{
          flex:1, overflow:'auto', padding:'14px 20px 24px',
          background:LG.surface, position:'relative',
        }}
      >
        <TOCCard items={TOC_ITEMS} open={tocOpen} onToggle={() => setTocOpen(!tocOpen)}/>
        <PolicyBody/>
      </div>
      <BackToTop visible={showTop} onClick={scrollTop}/>
    </LGPhone>
  );
}

// ═══════════════════════════════════════════════════════════════
// FRAME 2 — SECONDARY STATE: MID-SCROLL DEEP READING
// Demonstrates: TOC collapsed, scroll progress past TOC,
// back-to-top button visible, body reading section 4–5.
// ═══════════════════════════════════════════════════════════════
function FramePrivacyReading() {
  const [tocOpen, setTocOpen] = React.useState(false);
  const [showTop, setShowTop] = React.useState(true);
  const scrollerRef = React.useRef(null);

  const onScroll = (e) => setShowTop(e.target.scrollTop > 220);
  const scrollTop = () => scrollerRef.current?.scrollTo({top:0, behavior:'smooth'});

  // Auto-scroll once on mount so we land mid-document.
  React.useEffect(() => {
    const node = scrollerRef.current;
    if (node) node.scrollTop = 720;
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => window.lucide && window.lucide.createIcons(), 30);
    return () => clearTimeout(t);
  });

  return (
    <LGPhone>
      <LGTopBar title="Privacy policy"/>
      <MetaStrip updated="October 1, 2025" version="3.2"/>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        style={{
          flex:1, overflow:'auto', padding:'14px 20px 24px',
          background:LG.surface, position:'relative',
        }}
      >
        <TOCCard items={TOC_ITEMS} open={tocOpen} onToggle={() => setTocOpen(!tocOpen)}/>
        <PolicyBody/>
      </div>
      <BackToTop visible={showTop} onClick={scrollTop}/>
    </LGPhone>
  );
}

// ═══════════════════════════════════════════════════════════════
// A19.2 — TERMS OF SERVICE
// ═══════════════════════════════════════════════════════════════
const TERMS_TOC = [
  'Acceptance of these terms',
  'Eligibility & accounts',
  'Identity pillars',
  'Acceptable use',
  'Content & licenses',
  'Tokens, invites & access',
  'Payments & gigs',
  'Termination',
  'Disclaimers',
  'Limitation of liability',
  'Governing law & disputes',
  'Changes to these terms',
];

function TermsBody() {
  return (
    <React.Fragment>
      <H2 n={1}>Acceptance of these terms</H2>
      <P>
        These Terms of Service ("Terms") are a binding agreement between you and Pantopus, Inc. By creating an account, claiming an identity, or otherwise using Pantopus, you agree to these Terms and to our Privacy Policy.
      </P>
      <P>
        If you are using Pantopus on behalf of a business, you represent that you have authority to bind that business to these Terms.
      </P>

      <H2 n={2}>Eligibility &amp; accounts</H2>
      <P>
        You must be at least 13 years old to use Pantopus. You are responsible for the activity on your account and for keeping your credentials secure.
      </P>
      <Bullets items={[
        'Provide accurate information when you register',
        'Keep your password and device secure',
        'Notify us promptly of any unauthorized use',
        'One person may hold only one Personal identity',
      ]}/>

      <H2 n={3}>Identity pillars</H2>
      <P>
        Pantopus lets you operate up to three identity pillars — <DT>Personal</DT>, <DT>Home</DT>, and <DT>Business</DT>. Claiming a Home or Business pillar may require verification documents. You agree not to claim an identity you are not entitled to represent.
      </P>
      <P>
        We may revoke a pillar if a claim is found to be false, disputed by a rightful owner, or used to impersonate another party.
      </P>

      <H2 n={4}>Acceptable use</H2>
      <P>You agree not to use Pantopus to:</P>
      <Bullets items={[
        'Harass, threaten, or impersonate other members',
        'Post unlawful, fraudulent, or misleading content',
        'Scrape, reverse-engineer, or overload the service',
        'Circumvent the walls between identity pillars',
        'Resell access or Tokens without our written consent',
      ]}/>

      <H2 n={5}>Content &amp; licenses</H2>
      <P>
        You retain ownership of the content you post. By posting, you grant Pantopus a non-exclusive, worldwide license to host, display, and distribute that content as needed to operate the service.
      </P>
      <H3>Feedback</H3>
      <P>
        If you send us ideas or suggestions, you grant us a perpetual, royalty-free license to use them without obligation to you.
      </P>

      <H2 n={6}>Tokens, invites &amp; access</H2>
      <P>
        A <DT>Token</DT> grants limited, revocable access to a Home, Business, or guest context. Tokens are personal to the recipient and may not be transferred. Either party may revoke a Token at any time from Settings.
      </P>

      <H2 n={7}>Payments &amp; gigs</H2>
      <P>
        Some features — local gigs, marketplace listings, and premium pillars — involve payments processed by our third-party providers. You agree to their terms in addition to ours. Fees are disclosed before you confirm a transaction.
      </P>
      <Bullets items={[
        'Gig payments are released on completion or per the listing terms',
        'Refunds follow the policy shown at checkout',
        'You are responsible for any taxes on income you earn',
      ]}/>

      <H2 n={8}>Termination</H2>
      <P>
        You may delete a pillar or your entire account at any time. We may suspend or terminate access if you violate these Terms, create risk for other members, or as required by law. Sections that by their nature should survive termination will survive.
      </P>

      <H2 n={9}>Disclaimers</H2>
      <P>
        Pantopus is provided "as is" and "as available." We do not warrant that the service will be uninterrupted, error-free, or that any member is who they claim to be beyond the verification we describe.
      </P>

      <H2 n={10}>Limitation of liability</H2>
      <P>
        To the maximum extent permitted by law, Pantopus will not be liable for indirect, incidental, or consequential damages, or for any amount exceeding the greater of the fees you paid us in the past 12 months or one hundred U.S. dollars.
      </P>

      <H2 n={11}>Governing law &amp; disputes</H2>
      <P>
        These Terms are governed by the laws of the State of Delaware, without regard to its conflict-of-laws rules. Disputes will be resolved in the state or federal courts located in Delaware, unless applicable law requires otherwise.
      </P>

      <H2 n={12}>Changes to these terms</H2>
      <P>
        We may update these Terms from time to time. For material changes we'll update the "Last updated" date and give in-app notice at least 14 days before they take effect. Continued use after that date means you accept the revised Terms.
      </P>

      <ContactFooter email="legal@pantopus.com" label="Questions about these terms?"/>
    </React.Fragment>
  );
}

function FrameTermsTop() {
  const [tocOpen, setTocOpen] = React.useState(true);
  const [showTop, setShowTop] = React.useState(false);
  const scrollerRef = React.useRef(null);
  const onScroll = (e) => setShowTop(e.target.scrollTop > 220);
  const scrollTop = () => scrollerRef.current?.scrollTo({top:0, behavior:'smooth'});
  React.useEffect(() => {
    const t = setTimeout(() => window.lucide && window.lucide.createIcons(), 30);
    return () => clearTimeout(t);
  });
  return (
    <LGPhone>
      <LGTopBar title="Terms of service"/>
      <MetaStrip updated="February 14, 2026" version="5.0"/>
      <div ref={scrollerRef} onScroll={onScroll} style={{
        flex:1, overflow:'auto', padding:'14px 20px 24px',
        background:LG.surface, position:'relative',
      }}>
        <TOCCard items={TERMS_TOC} open={tocOpen} onToggle={() => setTocOpen(!tocOpen)}/>
        <TermsBody/>
      </div>
      <BackToTop visible={showTop} onClick={scrollTop}/>
    </LGPhone>
  );
}

function FrameTermsReading() {
  const [tocOpen, setTocOpen] = React.useState(false);
  const [showTop, setShowTop] = React.useState(true);
  const scrollerRef = React.useRef(null);
  const onScroll = (e) => setShowTop(e.target.scrollTop > 220);
  const scrollTop = () => scrollerRef.current?.scrollTo({top:0, behavior:'smooth'});
  React.useEffect(() => {
    const node = scrollerRef.current;
    if (node) node.scrollTop = 760;
  }, []);
  React.useEffect(() => {
    const t = setTimeout(() => window.lucide && window.lucide.createIcons(), 30);
    return () => clearTimeout(t);
  });
  return (
    <LGPhone>
      <LGTopBar title="Terms of service"/>
      <MetaStrip updated="February 14, 2026" version="5.0"/>
      <div ref={scrollerRef} onScroll={onScroll} style={{
        flex:1, overflow:'auto', padding:'14px 20px 24px',
        background:LG.surface, position:'relative',
      }}>
        <TOCCard items={TERMS_TOC} open={tocOpen} onToggle={() => setTocOpen(!tocOpen)}/>
        <TermsBody/>
      </div>
      <BackToTop visible={showTop} onClick={scrollTop}/>
    </LGPhone>
  );
}

Object.assign(window, { FramePrivacyTop, FramePrivacyReading, FrameTermsTop, FrameTermsReading });
