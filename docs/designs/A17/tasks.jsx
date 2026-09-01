// MailTaskScreen — A17 archetype × Mail-task variant.
// A task Pantopus auto-extracted from a piece of mail.
// Slots beyond the archetype:
//   - Task card pulled from mail (title, priority, progress, due)
//   - Due-date / reminder card with quick-snooze
//   - Subtask checklist
//   - Source-mail card (the mail it came from)
//   - Action bar: Mark done (primary) · Snooze · Delegate
//   - Secondary "done" state: completion summary + next-up suggestion

// ── Data ───────────────────────────────────────────────────
const TASK = {
  accent: '#4f46e5',           // indigo — action / productivity
  category: 'Task',
  trust: 'verified',
  time: 'Auto-created · 1h ago',
  title: 'Submit written comment on the 412 Elm St rezoning',
  ref: 'Zoning variance ZA-2026-0188 · City of Oakland Planning',
  priority: 'High',
  due: { weekday: 'FRI', day: '30', month: 'MAY', label: 'Due tomorrow', time: '5:00 PM', left: '~1 day left' },
};

const STEPS = [
  { label: 'Draft your written comment', done: true,  hint: 'Pantopus pre-filled the case number + your address' },
  { label: 'Attach 2 site photos',       done: false, hint: 'Rear-yard setback, looking north' },
  { label: 'Submit via the Planning portal', done: false, hint: 'oaklandca.gov/planning · case ZA-2026-0188' },
];

const SOURCE = {
  accent: '#f97316',
  trust: 'verified',
  category: 'Certified',
  sender: 'City of Oakland · Planning',
  title: 'Notice of public hearing — 412 Elm St',
  snippet: 'Written comment accepted through May 30. Hearing scheduled June 3, 2026 at 6:00 PM.',
  time: 'May 27',
};

const SNOOZE = [
  { icon: 'sun',          label: 'This evening', when: '6:00 PM' },
  { icon: 'sunrise',      label: 'Tomorrow AM',  when: 'Fri 9:00' },
  { icon: 'calendar-days',label: 'Pick a time',  when: null },
];

const ELF_OPEN = {
  headline: 'Pantopus made this task for you',
  summary: 'I spotted a hard deadline in your certified mail from City Planning. The comment window closes Fri May 30 at 5 PM — about a day out. I pre-drafted a comment with the case number and your address; a quick review plus two photos should do it.',
  bullets: [
    { icon: 'clock',       label: 'Closes Fri 5:00 PM', text: 'no late comments accepted' },
    { icon: 'file-pen',    label: 'Draft ready',        text: 'review + edit, ~10 min' },
    { icon: 'map-pin',     label: 'About your block',   text: '412 Elm is 2 doors down' },
  ],
};

const ELF_DONE = {
  headline: 'Submitted — nice work',
  summary: 'Your comment was filed with City Planning at 4:12 PM, well ahead of the 5 PM cutoff. I saved the confirmation to your Vault and set a reminder for the June 3 hearing in case you want to attend.',
  bullets: [
    { icon: 'badge-check', label: 'Confirmation #C-8841', text: 'saved to Vault' },
    { icon: 'calendar-check', label: 'Hearing Jun 3, 6 PM', text: 'reminder set' },
    { icon: 'undo-2',      label: 'Changed your mind?',  text: 'you can reopen below' },
  ],
};

const NEXT_UP = {
  accent: '#16a34a',
  category: 'Invoice',
  title: 'Pay Riverside Linen — $642.50',
  due: 'Due in 3 days',
  from: 'From your Counter',
};

// ── Card shell ─────────────────────────────────────────────
function TkCard({ children, accent, style = {}, noPad = false }) {
  return (
    <div style={{
      position: 'relative', background: '#fff',
      border: '1px solid var(--app-border)', borderRadius: 16,
      padding: noPad ? 0 : 14, overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,0.03)', ...style,
    }}>
      {accent && (
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: accent }}></div>
      )}
      <div style={{ paddingLeft: accent ? 4 : 0 }}>{children}</div>
    </div>
  );
}
function CardLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>{children}</div>
      {right}
    </div>
  );
}

// ── Top nav ────────────────────────────────────────────────
function TaskNav() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 8px 8px 4px',
      background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--app-border-subtle)', gap: 4,
    }}>
      <button style={tkNavBtn}>
        <i data-lucide="chevron-left" style={{ width: 22, height: 22 }}></i>
        <span style={{ fontSize: 15, fontWeight: 500, marginLeft: -2 }}>Mailbox</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: TASK.accent }}></span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Task</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={tkNavIco}><i data-lucide="share" style={{ width: 18, height: 18 }}></i></button>
        <button style={tkNavIco}><i data-lucide="more-horizontal" style={{ width: 18, height: 18 }}></i></button>
      </div>
    </div>
  );
}
const tkNavBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 2, border: 'none', background: 'transparent',
  color: 'var(--color-primary-600)', padding: '6px 6px', cursor: 'pointer', borderRadius: 8,
};
const tkNavIco = {
  width: 34, height: 34, borderRadius: 9999, border: 'none',
  background: 'var(--app-surface-sunken)', color: 'var(--fg2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};

// ── Priority flag ──────────────────────────────────────────
function PriorityFlag({ level }) {
  const map = {
    High:   { bg: '#fef2f2', fg: '#b91c1c', icon: 'flag' },
    Medium: { bg: '#fffbeb', fg: '#92400e', icon: 'flag' },
    Low:    { bg: '#f3f4f6', fg: '#4b5563', icon: 'flag' },
  };
  const c = map[level];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 9999, background: c.bg, color: c.fg,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1,
    }}>
      <i data-lucide={c.icon} style={{ width: 10, height: 10 }}></i>
      {level} priority
    </span>
  );
}

// ── Task hero ──────────────────────────────────────────────
function TaskHero({ done }) {
  const total = STEPS.length;
  const finished = done ? total : STEPS.filter(s => s.done).length;
  const pct = finished / total;
  return (
    <TkCard accent={done ? 'var(--color-success)' : TASK.accent} style={{ overflow: 'visible' }}>
      <div style={{ paddingLeft: 6 }}>
        {/* top row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          {done ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 9999,
              background: 'var(--color-success-bg)', color: '#047857',
              fontSize: 10, fontWeight: 700, lineHeight: 1,
            }}>
              <i data-lucide="check-circle-2" style={{ width: 11, height: 11 }}></i>
              Completed
            </span>
          ) : <PriorityFlag level={TASK.priority} />}
          <span style={{ flex: 1 }}></span>
          <span style={{
            fontSize: 10, color: 'var(--fg3)', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
          }}>
            <i data-lucide="sparkles" style={{ width: 10, height: 10 }}></i>
            Auto-created
          </span>
        </div>

        {/* title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: 1,
            border: done ? 'none' : `2px solid ${TASK.accent}`,
            background: done ? 'var(--color-success)' : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
          }}>
            {done && <i data-lucide="check" style={{ width: 15, height: 15 }}></i>}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 17, fontWeight: 700, color: 'var(--fg1)',
              letterSpacing: '-0.01em', lineHeight: 1.28, textWrap: 'pretty',
              textDecoration: done ? 'line-through' : 'none',
              textDecorationColor: 'var(--app-text-muted)',
            }}>{TASK.title}</div>
            <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 4, lineHeight: 1.4 }}>{TASK.ref}</div>
          </div>
        </div>

        {/* progress */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg2)' }}>
              {finished} of {total} steps {done ? 'done' : 'complete'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 600 }}>{Math.round(pct * 100)}%</span>
          </div>
          <div style={{ height: 7, borderRadius: 9999, background: 'var(--app-surface-sunken)', overflow: 'hidden' }}>
            <div style={{
              width: `${pct * 100}%`, height: '100%', borderRadius: 9999,
              background: done ? 'var(--color-success)' : TASK.accent,
              transition: 'width .3s',
            }}></div>
          </div>
        </div>

        {/* due chip */}
        {!done && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 14,
            padding: '8px 12px', borderRadius: 10,
            background: '#fef2f2', border: '1px solid #fecaca',
          }}>
            <i data-lucide="alarm-clock" style={{ width: 15, height: 15, color: '#b91c1c' }}></i>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#991b1b' }}>{TASK.due.label}</span>
            <span style={{ fontSize: 12, color: '#b91c1c' }}>· {TASK.due.weekday.charAt(0) + TASK.due.weekday.slice(1).toLowerCase()} {TASK.due.month.charAt(0) + TASK.due.month.slice(1).toLowerCase()} {TASK.due.day} · {TASK.due.time}</span>
          </div>
        )}
        {done && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 14,
            padding: '8px 12px', borderRadius: 10,
            background: 'var(--color-success-bg)', border: '1px solid var(--color-success-light)',
          }}>
            <i data-lucide="check-circle-2" style={{ width: 15, height: 15, color: '#047857' }}></i>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#065f46' }}>Done May 28 · 4:12 PM</span>
            <span style={{ fontSize: 12, color: '#047857' }}>· 1 day early</span>
          </div>
        )}
      </div>
    </TkCard>
  );
}

// ── Due / reminder card (open state) ───────────────────────
function DueCard() {
  return (
    <TkCard>
      <CardLabel right={
        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#b91c1c', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626' }}></span>
          {TASK.due.left}
        </span>
      }>Due date</CardLabel>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* calendar block */}
        <div style={{
          width: 58, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
          border: '1px solid var(--app-border)', textAlign: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            background: TASK.accent, color: '#fff',
            fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', padding: '3px 0',
          }}>{TASK.due.month}</div>
          <div style={{ padding: '4px 0 5px' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--fg1)', lineHeight: 1, letterSpacing: '-0.02em' }}>{TASK.due.day}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg3)', letterSpacing: '0.06em', marginTop: 2 }}>{TASK.due.weekday}</div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg1)' }}>{TASK.due.label} · {TASK.due.time}</div>
          <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
            <i data-lucide="bell" style={{ width: 12, height: 12 }}></i>
            Reminder set for 9:00 AM
          </div>
        </div>
      </div>

      {/* snooze quick row */}
      <div style={{
        display: 'flex', gap: 8, marginTop: 12, paddingTop: 12,
        borderTop: '1px solid var(--app-border-subtle)',
      }}>
        {SNOOZE.map((s, i) => (
          <button key={i} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
            background: 'var(--app-surface-sunken)', border: '1px solid transparent',
            color: 'var(--fg2)',
          }}>
            <i data-lucide={s.icon} style={{ width: 16, height: 16, color: TASK.accent }}></i>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg1)' }}>{s.label}</span>
            {s.when && <span style={{ fontSize: 9.5, color: 'var(--fg3)' }}>{s.when}</span>}
          </button>
        ))}
      </div>
    </TkCard>
  );
}

// ── Checklist ──────────────────────────────────────────────
function Checklist({ done }) {
  return (
    <TkCard noPad>
      <div style={{ padding: '12px 14px 4px' }}>
        <CardLabel right={
          <button style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--color-primary-600)', fontSize: 11, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            <i data-lucide="plus" style={{ width: 12, height: 12 }}></i>
            Add step
          </button>
        }>Steps</CardLabel>
      </div>
      <div>
        {STEPS.map((s, i) => {
          const checked = done || s.done;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 11,
              padding: '11px 14px',
              borderTop: '1px solid var(--app-border-subtle)',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                border: checked ? 'none' : '2px solid var(--app-border-strong)',
                background: checked ? 'var(--color-success)' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              }}>
                {checked && <i data-lucide="check" style={{ width: 12, height: 12 }}></i>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13.5, fontWeight: 600, color: checked ? 'var(--fg3)' : 'var(--fg1)',
                  letterSpacing: '-0.005em', lineHeight: 1.3,
                  textDecoration: checked ? 'line-through' : 'none',
                }}>{s.label}</div>
                {!checked && <div style={{ fontSize: 11.5, color: 'var(--fg3)', marginTop: 2, lineHeight: 1.4 }}>{s.hint}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </TkCard>
  );
}

// ── Source mail card ───────────────────────────────────────
function SourceMail() {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 4px 8px',
      }}>Pulled from this mail</div>
      <div style={{
        position: 'relative', background: '#fff', border: '1px solid var(--app-border)',
        borderRadius: 16, padding: '12px 14px 12px 18px', overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: SOURCE.accent }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
          <TrustChip kind={SOURCE.trust} />
          <CategoryChip label={SOURCE.category} color={SOURCE.accent} />
          <span style={{ flex: 1 }}></span>
          <span style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 500 }}>{SOURCE.time}</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{SOURCE.sender}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg1)', lineHeight: 1.3, letterSpacing: '-0.005em', marginBottom: 4 }}>{SOURCE.title}</div>
        <div style={{ fontSize: 12, color: 'var(--fg2)', lineHeight: 1.45 }}>{SOURCE.snippet}</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10,
          borderTop: '1px solid var(--app-border-subtle)',
          color: 'var(--color-primary-600)', fontSize: 12, fontWeight: 700,
        }}>
          <i data-lucide="mail-open" style={{ width: 13, height: 13 }}></i>
          Open original mail
          <i data-lucide="chevron-right" style={{ width: 13, height: 13, marginLeft: 'auto', color: 'var(--fg4)' }}></i>
        </div>
      </div>
    </div>
  );
}

// ── AI elf ─────────────────────────────────────────────────
function TaskElf({ data }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)',
      border: '1px solid #bae6fd', borderRadius: 16, padding: '12px 14px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 8, background: 'var(--color-primary-600)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(2,132,199,0.3)',
        }}>
          <i data-lucide="sparkles" style={{ width: 13, height: 13 }}></i>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', flex: 1, letterSpacing: '-0.005em' }}>{data.headline}</div>
      </div>
      <div style={{ fontSize: 13, color: '#0c4a6e', lineHeight: 1.5, marginBottom: 10, textWrap: 'pretty' }}>{data.summary}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.45, color: 'var(--fg1)' }}>
            <div style={{
              width: 16, height: 16, borderRadius: 4, background: '#fff', color: 'var(--color-primary-700)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, border: '1px solid #bae6fd',
            }}>
              <i data-lucide={b.icon} style={{ width: 10, height: 10 }}></i>
            </div>
            <span><strong style={{ fontWeight: 700 }}>{b.label}</strong>
              <span style={{ color: 'var(--fg2)' }}> — {b.text}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Next-up card (done state) ──────────────────────────────
function NextUp() {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--fg3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 4px 8px',
      }}>Next up from your mail</div>
      <div style={{
        position: 'relative', background: '#fff', border: '1px solid var(--app-border)',
        borderRadius: 16, padding: '12px 14px 12px 18px', overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: NEXT_UP.accent }}></div>
        <div style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: '#dcfce7', color: '#15803d',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i data-lucide="credit-card" style={{ width: 18, height: 18 }}></i>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg1)', letterSpacing: '-0.005em' }}>{NEXT_UP.title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--fg3)', marginTop: 2 }}>
            <span style={{ color: '#b45309', fontWeight: 700 }}>{NEXT_UP.due}</span> · {NEXT_UP.from}
          </div>
        </div>
        <button style={{
          padding: '7px 14px', borderRadius: 9999, background: 'var(--color-primary-600)', color: '#fff',
          border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
        }}>Open</button>
      </div>
    </div>
  );
}

// ── Completion summary (done state) ────────────────────────
function CompletionCard() {
  return (
    <TkCard>
      <CardLabel>What got filed</CardLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SummaryRow icon="file-check-2" label="Comment submitted" value="3 paragraphs + 2 photos" />
        <SummaryRow icon="hash" label="Confirmation" value="C-8841" mono />
        <SummaryRow icon="building-2" label="Filed with" value="Oakland Planning" />
        <SummaryRow icon="clock" label="Time" value="May 28 · 4:12 PM" />
      </div>
    </TkCard>
  );
}
function SummaryRow({ icon, label, value, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: 'var(--app-surface-sunken)', color: 'var(--fg2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i data-lucide={icon} style={{ width: 14, height: 14 }}></i>
      </div>
      <span style={{ fontSize: 12.5, color: 'var(--fg3)', flex: 1 }}>{label}</span>
      <span style={{
        fontSize: 12.5, fontWeight: 700, color: 'var(--fg1)',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit', letterSpacing: mono ? '0.02em' : '-0.005em',
      }}>{value}</span>
    </div>
  );
}

// ── Action bars ────────────────────────────────────────────
function TaskActions() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button style={{
        width: '100%', padding: '14px 16px', background: 'var(--color-primary-600)', color: '#fff',
        border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, letterSpacing: '-0.005em',
        boxShadow: 'var(--shadow-primary)', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap',
      }}>
        <i data-lucide="check" style={{ width: 17, height: 17 }}></i>
        Mark done
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <TkChip icon="clock" label="Snooze" />
        <TkChip icon="user-plus" label="Delegate" />
        <TkChip icon="calendar-plus" label="Calendar" />
      </div>
    </div>
  );
}
function DoneActions() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button style={{
        width: '100%', padding: '14px 16px', background: '#fff', color: 'var(--color-primary-700)',
        border: '1.5px solid var(--color-primary-200)', borderRadius: 14, fontSize: 15, fontWeight: 700,
        letterSpacing: '-0.005em', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap',
      }}>
        <i data-lucide="undo-2" style={{ width: 16, height: 16 }}></i>
        Reopen task
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <TkChip icon="file-text" label="View confirmation" />
        <TkChip icon="archive" label="Archive" />
      </div>
    </div>
  );
}
function TkChip({ icon, label }) {
  return (
    <button style={{
      background: '#fff', border: '1px solid var(--app-border)', borderRadius: 12, padding: '10px 4px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      color: 'var(--fg2)', cursor: 'pointer', fontSize: 10.5, fontWeight: 600,
    }}>
      <i data-lucide={icon} style={{ width: 17, height: 17 }}></i>
      {label}
    </button>
  );
}

// ── Delegated avatars hint (open state, small touch) ───────
function DelegateHint() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', background: '#fff',
      border: '1px solid var(--app-border)', borderRadius: 14,
    }}>
      <div style={{ display: 'flex' }}>
        {['#4f46e5', '#0e7490', '#b45309'].map((c, i) => (
          <div key={i} style={{
            width: 26, height: 26, borderRadius: '50%', background: c, color: '#fff',
            border: '2px solid #fff', marginLeft: i ? -8 : 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700,
          }}>{['JR', 'MV', 'DK'][i]}</div>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg1)' }}>Hand this off</div>
        <div style={{ fontSize: 11, color: 'var(--fg3)' }}>Delegate to someone in your Home drawer</div>
      </div>
      <i data-lucide="chevron-right" style={{ width: 16, height: 16, color: 'var(--fg4)' }}></i>
    </div>
  );
}

// ── Screen ─────────────────────────────────────────────────
function MailTaskScreen({ state = 'open', dataLabel }) {
  const done = state === 'done';
  return (
    <div data-screen-label={dataLabel} style={{
      width: '100%', height: '100%', background: 'var(--app-bg)',
      display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
      paddingTop: 54,
    }}>
      <TaskNav />

      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px 16px 96px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px' }}>
            <TrustChip kind={TASK.trust} />
            <CategoryChip label={TASK.category} color={TASK.accent} />
            <span style={{ flex: 1 }}></span>
            <span style={{ fontSize: 11, color: 'var(--fg3)', fontWeight: 500 }}>{TASK.time}</span>
          </div>

          <TaskHero done={done} />
          <TaskElf data={done ? ELF_DONE : ELF_OPEN} />

          {done ? (
            <>
              <CompletionCard />
              <Checklist done />
              <SourceMail />
              <NextUp />
              <DoneActions />
            </>
          ) : (
            <>
              <DueCard />
              <Checklist done={false} />
              <SourceMail />
              <DelegateHint />
              <TaskActions />
            </>
          )}
        </div>
      </div>

      <BottomTabBar active="mail" />
    </div>
  );
}

Object.assign(window, { MailTaskScreen });
