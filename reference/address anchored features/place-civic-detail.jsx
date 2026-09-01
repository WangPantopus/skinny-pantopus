// ─────────────────────────────────────────────────────────────
// Place — C8 · Civic detail
// ContentDetail. Informational only — never advocacy.
//  • Your districts (evergreen) — the elected levels for your address,
//    always present, shown even off-season. Deep-evergreen "seal" treatment.
//  • Your representatives — name · office · contact, grouped by level.
//  • Election — in-season: polling place, your ballot (tap-through), candidates.
//    off-season: a calm "No upcoming election", districts still shown.
// ─────────────────────────────────────────────────────────────

const EVERGREEN = '#15803d';      // deep civic green — gravitas vs the brighter home green
const EVERGREEN_BG = '#E7F1EA';   // muted official tint

// ─────────────────────────────────────────────────────────────
// Your districts — the always-on civic baseline
// ─────────────────────────────────────────────────────────────
const DISTRICTS = [
  { group: 'Federal', rows: [
    { level: 'U.S. House', value: 'Oregon’s 3rd District' },
  ]},
  { group: 'State', rows: [
    { level: 'State Senate', value: 'District 23' },
    { level: 'State House', value: 'District 46' },
  ]},
  { group: 'Local', rows: [
    { level: 'County', value: 'Multnomah County' },
    { level: 'City Council', value: 'Portland · District 3' },
    { level: 'School', value: 'Portland Public Schools' },
  ]},
];

function DistrictsCard() {
  return (
    <div className="pl-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* evergreen seal header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', background: EVERGREEN_BG, borderBottom: '1px solid #d6e6dc' }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: '#fff', border: `1.5px solid ${EVERGREEN}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="landmark" size={21} color={EVERGREEN} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#14532d', letterSpacing: '-0.01em' }}>Your districts</div>
          <div style={{ fontSize: 12.5, color: '#3f6b4f', marginTop: 1 }}>The elected levels that cover your address</div>
        </div>
        <Chip tone="success" icon="check">Current</Chip>
      </div>

      <div style={{ padding: '4px 16px 8px' }}>
        {DISTRICTS.map((g, gi) => (
          <div key={g.group}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', margin: gi === 0 ? '12px 0 2px' : '14px 0 2px' }}>{g.group}</div>
            {g.rows.map((r, i) => (
              <div key={r.level} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: (gi === DISTRICTS.length - 1 && i === g.rows.length - 1) ? 'none' : '1px solid #f4f5f7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: EVERGREEN, flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, color: MUTE }}>{r.level}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: INK, textAlign: 'right' }}>{r.value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Your representatives — name · office · contact, by level
// ─────────────────────────────────────────────────────────────
const REPS = [
  { group: 'Federal', people: [
    { name: 'Ron Wyden', office: 'U.S. Senator', initials: 'RW', party: 'D', contacts: ['phone', 'globe'] },
    { name: 'Jeff Merkley', office: 'U.S. Senator', initials: 'JM', party: 'D', contacts: ['phone', 'globe'] },
    { name: 'Earl Blumenauer', office: 'U.S. Representative · OR-3', initials: 'EB', party: 'D', contacts: ['phone', 'mail', 'globe'] },
  ]},
  { group: 'State', people: [
    { name: 'Tina Kotek', office: 'Governor', initials: 'TK', party: 'D', contacts: ['phone', 'globe'] },
    { name: 'Kayse Jama', office: 'State Senator · D-23', initials: 'KJ', party: 'D', contacts: ['mail', 'globe'] },
    { name: 'Khanh Pham', office: 'State Representative · D-46', initials: 'KP', party: 'D', contacts: ['mail', 'globe'] },
  ]},
  { group: 'Local', people: [
    { name: 'Keith Wilson', office: 'Mayor of Portland', initials: 'KW', party: '—', contacts: ['phone', 'globe'] },
    { name: 'Angelita Morillo', office: 'City Council · District 3', initials: 'AM', party: '—', contacts: ['mail', 'globe'] },
  ]},
];

function RepAvatar({ initials }) {
  return (
    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f1f3f5', border: '1px solid #e5e7eb', color: '#4b5563', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0, letterSpacing: 0.2 }}>{initials}</div>
  );
}

function ContactBtn({ icon }) {
  const labels = { phone: 'Call', mail: 'Email', globe: 'Website' };
  return (
    <button className="cv-contact" aria-label={labels[icon]} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
      <Icon name={icon} size={16} color={SKY} strokeWidth={2} />
    </button>
  );
}

function RepRow({ person, isLast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: isLast ? 'none' : '1px solid #f4f5f7' }}>
      <RepAvatar initials={person.initials} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: INK, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.name}</span>
          {person.party !== '—' && <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>({person.party})</span>}
        </div>
        <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.office}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {person.contacts.map((c) => <ContactBtn key={c} icon={c} />)}
      </div>
    </div>
  );
}

function RepsList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {REPS.map((g) => (
        <div key={g.group}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 7px 4px' }}>{g.group}</div>
          <div className="pl-card" style={{ padding: 0, overflow: 'hidden' }}>
            {g.people.map((p, i) => <RepRow key={p.name} person={p} isLast={i === g.people.length - 1} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Election — in-season block (polling place + ballot + candidates)
// ─────────────────────────────────────────────────────────────
const ELECTION = {
  name: 'May 2026 Primary Election',
  date: 'Tuesday, May 19, 2026',
  daysAway: 12,
  polling: { name: 'Vote by mail · Oregon', sub: 'Ballots mailed to every registered voter', detail: 'Return by mail or to any county drop box by 8:00 PM on election day.' },
};

const BALLOT = [
  { type: 'office', title: 'U.S. Representative · District 3', candidates: ['Maxine Dexter', 'Joe Polise', 'David Walker'] },
  { type: 'office', title: 'Governor', candidates: ['Tina Kotek', 'Christine Drazan', 'Nick Kristof'] },
  { type: 'office', title: 'County Commissioner · District 2', candidates: ['Jesse Beason', 'Sandra Gomez'] },
  { type: 'measure', title: 'Measure 26-250', summary: 'Renews the local levy that funds parks, trails, and natural-area maintenance for five years.' },
];

function ElectionBanner() {
  return (
    <div className="pl-card" style={{ padding: 16, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: '#E0F2FE', border: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>May</span>
          <span style={{ fontSize: 19, fontWeight: 800, color: '#0369a1', marginTop: 1 }}>19</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>{ELECTION.name}</div>
          <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 1 }}>{ELECTION.date}</div>
        </div>
        <Chip tone="sky">{ELECTION.daysAway} days away</Chip>
      </div>
    </div>
  );
}

function PollingCard() {
  const p = ELECTION.polling;
  return (
    <div className="pl-card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: HOME_GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="mail" size={19} color={HOME_GREEN} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: INK }}>{p.name}</div>
          <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 1 }}>{p.sub}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: INK2, lineHeight: '19px', marginTop: 11, paddingTop: 11, borderTop: '1px solid #f1f3f5' }}>{p.detail}</div>
    </div>
  );
}

function BallotPreview({ onOpen }) {
  const offices = BALLOT.filter((b) => b.type === 'office').length;
  const measures = BALLOT.filter((b) => b.type === 'measure').length;
  return (
    <button onClick={onOpen} className="hm-prompt" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.04)', padding: 15 }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: HOME_GREEN_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="vote" size={20} color={HOME_GREEN} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>Your ballot</div>
        <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 2 }}>{offices} offices · {measures} measure · plain-language preview</div>
      </div>
      <Icon name="chevron-right" size={18} color="#c4c8cf" strokeWidth={2.25} />
    </button>
  );
}

// ── Ballot leaf — full races, candidates, measures (plain language) ──
function BallotDetail({ onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DetailHeader title="Your ballot" address={ELECTION.name} onBack={onBack} />
        <div style={{ padding: '6px 16px 40px' }}>
          <div className="pl-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 11 }}>
            <Icon name="info" size={17} color={SKY} strokeWidth={2} />
            <span style={{ fontSize: 13, color: INK2, lineHeight: '19px' }}>A preview of what you’ll be asked to decide. Candidate order is randomized, the same as on your official ballot.</span>
          </div>

          <SectionLabel>Offices</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {BALLOT.filter((b) => b.type === 'office').map((race) => (
              <div key={race.title} className="pl-card" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>{race.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 8 }}>
                  {race.candidates.map((c, i) => (
                    <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i === race.candidates.length - 1 ? 'none' : '1px solid #f4f5f7' }}>
                      <span style={{ width: 16, height: 16, borderRadius: 4, border: '1.75px solid #c4c8cf', flexShrink: 0 }} />
                      <span style={{ fontSize: 14, color: INK2 }}>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <SectionLabel>Measures</SectionLabel>
          {BALLOT.filter((b) => b.type === 'measure').map((m) => (
            <div key={m.title} className="pl-card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>{m.title}</div>
              <div style={{ fontSize: 13.5, color: INK2, lineHeight: '20px', marginTop: 5 }}>{m.summary}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
                {['Yes', 'No'].map((opt) => (
                  <div key={opt} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, border: '1.75px solid #c4c8cf', flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: INK2 }}>{opt}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <Source name="Ballot data · official county elections" asOf="May 2026 primary" />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 18, padding: '12px 14px', background: '#fff', border: '1px solid #eef0f2', borderRadius: 12 }}>
            <Icon name="info" size={15} color="#9ca3af" strokeWidth={2} style={{ marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: MUTE, lineHeight: '18px' }}>A neutral preview for reference. Pantopus doesn’t endorse candidates or measures. Your official ballot is the record that counts.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Off-season election state — calm, districts still shown ──
function NoElection() {
  return (
    <div className="pl-card" style={{ padding: '22px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: 13, background: '#f1f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Icon name="calendar-check" size={24} color="#9ca3af" strokeWidth={2} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: INK, letterSpacing: '-0.01em' }}>No upcoming election</div>
      <div style={{ fontSize: 13.5, color: MUTE, lineHeight: '20px', marginTop: 5, maxWidth: 280 }}>There’s nothing on your ballot right now. We’ll surface your polling place and ballot here as soon as a date is set.</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Assembled Civic detail
//   season: 'in'  -> election present (banner, polling, ballot)
//           'off' -> calm "No upcoming election", districts still shown
// ─────────────────────────────────────────────────────────────
function CivicDetail({ season = 'in' }) {
  const { useState } = React;
  const [ballot, setBallot] = useState(false);

  if (ballot) return <BallotDetail onBack={() => setBallot(false)} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f6f7f9' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <DetailHeader title="Civic" address="1421 SE Oak St · Portland" onBack={() => {}} />

        <div style={{ padding: '6px 16px 40px' }}>
          <SectionLabel>Your districts</SectionLabel>
          <DistrictsCard />
          <Source name="District boundaries · public GIS records" asOf="current" />

          <SectionLabel>Your representatives</SectionLabel>
          <RepsList />
          <Source name="Open civic data · Google Civic Information" asOf="updated this term" />

          <SectionLabel>Election</SectionLabel>
          {season === 'in' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ElectionBanner />
              <PollingCard />
              <BallotPreview onOpen={() => setBallot(true)} />
            </div>
          ) : (
            <NoElection />
          )}
          {season === 'in' && <Source name="Election data · official county elections" asOf="May 2026 primary" />}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 18, padding: '12px 14px', background: '#fff', border: '1px solid #eef0f2', borderRadius: 12 }}>
            <Icon name="info" size={15} color="#9ca3af" strokeWidth={2} style={{ marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: MUTE, lineHeight: '18px' }}>Informational, drawn from public civic records for your address. Pantopus is nonpartisan and doesn’t endorse candidates or measures.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  CivicDetail, BallotDetail, DistrictsCard, RepsList, RepRow, ContactBtn,
  ElectionBanner, PollingCard, BallotPreview, NoElection,
  DISTRICTS, REPS, ELECTION, BALLOT, EVERGREEN, EVERGREEN_BG,
});
