// Pantopus — Calendarly · Embed / inline booking widget settings (web) — 5 frames
// Archetype: Settings form reusing the Edit Business Page block-editor with a
// code-snippet block. Web-only host settings → "Embed widget"; surfaces the
// /book/[slug] flow onto external sites or the host's /b/[username] page.
// Mirrors A13 Edit Business Page (two-column config + live preview), the A14
// settings-list rows, and A10.6 Business profile (where the inline booker lands).
//
// Business violet (var(--color-identity-business)) is the driving pillar — it's
// the widget's default brand color, shown in the preview's primary button and
// the brand swatch; a Personal sky variant is noted. All functional chrome
// (segmented control active, Copy snippet, toggles) stays product sky
// (var(--color-primary-600)). White cards, 1px border, 16px radius, shadow-sm,
// no left accents. Lucide stroke-2, no emoji. Voice plainspoken, verbs-first.
//
// Frames: inline (default) · popup-button · floating-button · appearance-config ·
// copied-snippet toast.

const VIOLET = 'var(--color-identity-business)';
const SKY = 'var(--color-primary-600)';

function Icon({ name, size = 18, color, stroke = 2, style }) {
  return <i data-lucide={name} style={{ width:size, height:size, color, strokeWidth:stroke, ...style }}/>;
}

// ─── Faux app nav (settings context) ──────────────────────────────────────

function AppNav() {
  return (
    <div style={{
      height:60, display:'flex', alignItems:'center', gap:14, padding:'0 28px',
      background:'rgba(255,255,255,0.92)', borderBottom:'1px solid var(--app-border)',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, fontWeight:700, fontSize:17, letterSpacing:-0.2, color:'var(--app-text)' }}>
        <span style={{
          width:28, height:28, borderRadius:8, background:SKY, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}><Icon name="calendar-clock" size={17} color="#fff"/></span>
        Calendarly
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginLeft:8, color:'var(--fg3)', fontSize:13.5 }}>
        <Icon name="chevron-right" size={15} color="var(--fg4)"/>
        <span>Settings</span>
        <Icon name="chevron-right" size={15} color="var(--fg4)"/>
        <span style={{ color:'var(--app-text)', fontWeight:600 }}>Embed widget</span>
      </div>
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:14 }}>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:9999,
          background:'var(--color-identity-business-bg)', color:VIOLET, fontSize:11.5, fontWeight:700,
        }}>
          <Icon name="briefcase" size={12} color={VIOLET} stroke={2.4}/>
          Northside Studio
        </span>
        <span style={{
          width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#a78bfa,#6d28d9)',
          color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12.5, fontWeight:700,
        }}>NS</span>
      </div>
    </div>
  );
}

// ─── Cards & primitives ───────────────────────────────────────────────────

function Card({ children, pad = 20, style }) {
  return (
    <div style={{
      background:'var(--app-surface)', border:'1px solid var(--app-border)', borderRadius:16,
      boxShadow:'var(--shadow-sm)', padding:pad, ...style,
    }}>{children}</div>
  );
}

function CardTitle({ icon, children, sub }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
        {icon && <Icon name={icon} size={16} color="var(--fg2)"/>}
        <span style={{ fontSize:14.5, fontWeight:700, color:'var(--app-text)', letterSpacing:-0.1 }}>{children}</span>
      </div>
      {sub && <div style={{ fontSize:12.5, color:'var(--fg3)', marginTop:5, lineHeight:'18px' }}>{sub}</div>}
    </div>
  );
}

function FieldLabel({ children }) {
  return <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase', color:'var(--fg3)', marginBottom:8 }}>{children}</div>;
}

function TextField({ value, mono }) {
  return (
    <div style={{
      padding:'9px 12px', background:'var(--app-surface)', border:'1px solid var(--app-border)', borderRadius:8,
      fontSize:13, color:'var(--app-text)', fontFamily: mono ? 'var(--font-mono)' : 'inherit', fontWeight: mono ? 500 : 500,
    }}>{value}</div>
  );
}

function Chips({ options, value, accent = SKY }) {
  return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
      {options.map(o => {
        const on = o === value;
        return (
          <span key={o} style={{
            padding:'7px 14px', borderRadius:9999, cursor:'pointer', fontSize:12.5, letterSpacing:-0.05,
            background: on ? accent : 'var(--app-surface)',
            border: `1px solid ${on ? accent : 'var(--app-border)'}`,
            color: on ? '#fff' : 'var(--fg2)', fontWeight: on ? 700 : 600,
          }}>{o}</span>
        );
      })}
    </div>
  );
}

function Toggle({ on, accent = SKY }) {
  return (
    <span style={{
      width:38, height:22, borderRadius:9999, background: on ? accent : 'var(--app-border-strong)',
      position:'relative', flexShrink:0, transition:'background 150ms', display:'inline-block',
    }}>
      <span style={{
        position:'absolute', top:2, left: on ? 18 : 2, width:18, height:18, borderRadius:'50%',
        background:'#fff', boxShadow:'0 1px 2px rgba(0,0,0,0.2)', transition:'left 150ms',
      }}/>
    </span>
  );
}

function Checkbox({ on, label }) {
  return (
    <label style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer' }}>
      <span style={{
        width:18, height:18, borderRadius:5, flexShrink:0,
        background: on ? SKY : 'var(--app-surface)', border: `1.5px solid ${on ? SKY : 'var(--app-border-strong)'}`,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>{on && <Icon name="check" size={12} color="#fff" stroke={3}/>}</span>
      <span style={{ fontSize:13, color:'var(--app-text)', fontWeight:500 }}>{label}</span>
    </label>
  );
}

// ─── Segmented embed-type control ─────────────────────────────────────────

function EmbedTypeSegment({ value }) {
  const opts = [
    { id:'inline', label:'Inline', icon:'layout-template' },
    { id:'popup', label:'Popup button', icon:'square-mouse-pointer' },
    { id:'floating', label:'Floating button', icon:'panel-bottom' },
  ];
  return (
    <div style={{
      display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:4, padding:4,
      background:'var(--app-surface-sunken)', borderRadius:12, border:'1px solid var(--app-border)',
    }}>
      {opts.map(o => {
        const on = o.id === value;
        return (
          <div key={o.id} style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'12px 6px',
            borderRadius:9, cursor:'pointer',
            background: on ? 'var(--app-surface)' : 'transparent',
            boxShadow: on ? 'var(--shadow-sm)' : 'none',
            border: on ? `1px solid var(--app-border)` : '1px solid transparent',
          }}>
            <Icon name={o.icon} size={20} color={on ? SKY : 'var(--fg3)'}/>
            <span style={{ fontSize:12, fontWeight: on ? 700 : 600, color: on ? 'var(--app-text)' : 'var(--fg3)', letterSpacing:-0.05 }}>{o.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Appearance card ──────────────────────────────────────────────────────

function ColorSwatch({ color, active }) {
  return (
    <span style={{
      width:26, height:26, borderRadius:8, background:color, cursor:'pointer', flexShrink:0,
      border: active ? '2px solid #fff' : '2px solid #fff',
      boxShadow: active ? `0 0 0 2px ${color}` : 'inset 0 0 0 1px rgba(0,0,0,0.08)',
    }}/>
  );
}

function AppearanceCard({ dark, colorOpen }) {
  return (
    <Card>
      <CardTitle icon="palette" sub="Match the widget to your site.">Appearance</CardTitle>

      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div>
          <FieldLabel>Brand color</FieldLabel>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              display:'flex', alignItems:'center', gap:9, padding:'7px 11px 7px 9px',
              border:'1px solid var(--app-border)', borderRadius:9, cursor:'pointer',
            }}>
              <span style={{ width:22, height:22, borderRadius:6, background:VIOLET, flexShrink:0 }}/>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:12.5, color:'var(--app-text)', fontWeight:600 }}>#7C3AED</span>
              <Icon name="chevron-down" size={14} color="var(--fg4)"/>
            </div>
            <span style={{ fontSize:11.5, color:'var(--fg3)' }}>Defaults to your Business color.</span>
          </div>

          {colorOpen && (
            <div style={{
              marginTop:10, padding:14, background:'var(--app-surface)', border:'1px solid var(--app-border)',
              borderRadius:12, boxShadow:'var(--shadow-md)', maxWidth:300,
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontSize:11.5, fontWeight:700, color:'var(--fg2)' }}>Pick a brand color</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--fg3)' }}>#7C3AED</span>
              </div>
              <div style={{ display:'flex', gap:9, alignItems:'center' }}>
                <ColorSwatch color="var(--color-identity-business)" active/>
                <ColorSwatch color="var(--color-primary-600)"/>
                <ColorSwatch color="var(--color-identity-home)"/>
                <ColorSwatch color="#111827"/>
                <ColorSwatch color="#EA580C"/>
                <span style={{
                  width:26, height:26, borderRadius:8, border:'1px dashed var(--app-border-strong)', flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
                }}><Icon name="plus" size={13} color="var(--fg3)"/></span>
              </div>
              <div style={{ marginTop:11, display:'flex', alignItems:'center', gap:7, fontSize:11, color:'var(--fg3)' }}>
                <Icon name="info" size={12} color="var(--color-primary-600)"/>
                On a Personal page this defaults to sky.
              </div>
            </div>
          )}
        </div>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--app-text)' }}>Theme</div>
            <div style={{ fontSize:11.5, color:'var(--fg3)', marginTop:1 }}>{dark ? 'Dark' : 'Light'}</div>
          </div>
          <div style={{ display:'flex', gap:4, padding:3, background:'var(--app-surface-sunken)', borderRadius:9, border:'1px solid var(--app-border)' }}>
            {[{ id:'light', icon:'sun' }, { id:'dark', icon:'moon' }].map(t => {
              const on = (t.id === 'dark') === !!dark;
              return (
                <span key={t.id} style={{
                  display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:7, cursor:'pointer',
                  background: on ? 'var(--app-surface)' : 'transparent', boxShadow: on ? 'var(--shadow-sm)' : 'none',
                  fontSize:12, fontWeight: on ? 700 : 600, color: on ? 'var(--app-text)' : 'var(--fg3)',
                }}>
                  <Icon name={t.icon} size={14} color={on ? SKY : 'var(--fg3)'}/>
                  {t.id === 'dark' ? 'Dark' : 'Light'}
                </span>
              );
            })}
          </div>
        </div>

        <Checkbox on label="Hide page header"/>

        <div>
          <FieldLabel>Primary button label</FieldLabel>
          <TextField value="Book a call"/>
        </div>

        <div>
          <FieldLabel>Calendar layout</FieldLabel>
          <Chips options={['Month', 'Week']} value="Month"/>
        </div>
      </div>
    </Card>
  );
}

// ─── Button config (popup / floating) ─────────────────────────────────────

function ButtonConfigCard({ floating }) {
  return (
    <Card>
      <CardTitle icon={floating ? 'panel-bottom' : 'square-mouse-pointer'}
        sub={floating ? 'A pill that follows visitors as they scroll.' : 'Opens your booking flow in a modal.'}>
        {floating ? 'Floating button' : 'Popup button'}
      </CardTitle>
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div>
          <FieldLabel>Button text</FieldLabel>
          <TextField value="Book a call"/>
        </div>
        <div>
          <FieldLabel>{floating ? 'Corner' : 'Position'}</FieldLabel>
          <Chips
            options={floating ? ['Bottom right', 'Bottom left'] : ['Inline', 'Centered']}
            value={floating ? 'Bottom right' : 'Inline'}
          />
        </div>
      </div>
    </Card>
  );
}

// ─── Snippet card ─────────────────────────────────────────────────────────

function SnippetCard({ type, copied }) {
  const snippets = {
    inline: [
      '<div id="pantopus-booking"></div>',
      '<script src="https://cal.pantopus.com/embed.js"',
      '  data-slug="northside-studio"',
      '  data-type="inline"></script>',
    ],
    popup: [
      '<script src="https://cal.pantopus.com/embed.js"',
      '  data-slug="northside-studio"',
      '  data-type="popup"',
      '  data-label="Book a call"></script>',
    ],
    floating: [
      '<script src="https://cal.pantopus.com/embed.js"',
      '  data-slug="northside-studio"',
      '  data-type="floating"',
      '  data-corner="br"></script>',
    ],
  };
  const lines = snippets[type];
  return (
    <Card>
      <CardTitle icon="code-2" sub="Paste this where the widget should appear.">Embed snippet</CardTitle>
      <div style={{
        background:'#0f172a', borderRadius:10, padding:'14px 16px', position:'relative',
        fontFamily:'var(--font-mono)', fontSize:12, lineHeight:'20px', color:'#e2e8f0', overflowX:'auto',
      }}>
        {lines.map((l, i) => (
          <div key={i} style={{ whiteSpace:'pre', color: l.includes('<script') || l.includes('<div') ? '#7dd3fc' : (l.trim().startsWith('data-') ? '#c4b5fd' : '#e2e8f0') }}>{l}</div>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:14 }}>
        <button style={{
          display:'inline-flex', alignItems:'center', gap:7, padding:'10px 16px', borderRadius:10, border:'none',
          cursor:'pointer', background: copied ? 'var(--color-success)' : SKY, color:'#fff',
          fontSize:13.5, fontWeight:700, letterSpacing:-0.1, fontFamily:'inherit',
          boxShadow: copied ? 'none' : 'var(--shadow-primary)',
        }}>
          <Icon name={copied ? 'check' : 'copy'} size={15} color="#fff" stroke={2.4}/>
          {copied ? 'Copied' : 'Copy snippet'}
        </button>
        <span style={{ fontSize:12, color:'var(--fg3)' }}>Works on any site — Webflow, WordPress, plain HTML.</span>
      </div>
    </Card>
  );
}

// ─── "Where it shows" note ────────────────────────────────────────────────

function WhereItShowsCard() {
  return (
    <Card>
      <div style={{ display:'flex', alignItems:'center', gap:13 }}>
        <div style={{
          width:38, height:38, borderRadius:10, flexShrink:0, background:'var(--color-primary-50)', color:SKY,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}><Icon name="globe" size={18} color={SKY}/></div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13.5, fontWeight:600, color:'var(--app-text)', letterSpacing:-0.1 }}>Show inline on /b/yourname</div>
          <div style={{ fontSize:12, color:'var(--fg3)', marginTop:2 }}>Use this on any site, or turn it on for your Pantopus business page.</div>
        </div>
        <Toggle on/>
      </div>
    </Card>
  );
}

// ─── RIGHT: live preview pane ─────────────────────────────────────────────

function BrowserChrome({ children }) {
  return (
    <div style={{
      background:'var(--app-surface)', border:'1px solid var(--app-border)', borderRadius:14, overflow:'hidden',
      boxShadow:'var(--shadow-md)',
    }}>
      <div style={{
        height:38, display:'flex', alignItems:'center', gap:8, padding:'0 14px',
        background:'var(--app-surface-sunken)', borderBottom:'1px solid var(--app-border)',
      }}>
        <span style={{ display:'flex', gap:6 }}>
          {['#f87171', '#fbbf24', '#34d399'].map(c => <span key={c} style={{ width:10, height:10, borderRadius:'50%', background:c }}/>)}
        </span>
        <div style={{
          flex:1, marginLeft:6, height:22, borderRadius:6, background:'var(--app-surface)', border:'1px solid var(--app-border)',
          display:'flex', alignItems:'center', gap:6, padding:'0 10px',
        }}>
          <Icon name="lock" size={10} color="var(--fg4)"/>
          <span style={{ fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>yoursite.com</span>
        </div>
      </div>
      {children}
    </div>
  );
}

// faux external site backdrop
function SiteBackdrop({ children, dim }) {
  return (
    <div style={{ position:'relative', minHeight:420, background:'var(--app-bg)', padding:'0', overflow:'hidden' }}>
      {/* faux site header */}
      <div style={{ height:46, display:'flex', alignItems:'center', gap:10, padding:'0 18px', background:'var(--app-surface)', borderBottom:'1px solid var(--app-border)' }}>
        <span style={{ width:22, height:22, borderRadius:6, background:'var(--fg1)' }}/>
        <span style={{ width:80, height:9, borderRadius:3, background:'var(--app-border-strong)' }}/>
        <div style={{ marginLeft:'auto', display:'flex', gap:14 }}>
          {[44, 38, 50].map((w, i) => <span key={i} style={{ width:w, height:8, borderRadius:3, background:'var(--app-border)' }}/>)}
        </div>
      </div>
      {children}
    </div>
  );
}

// the embedded booker (inline)
function EmbeddedBooker() {
  return (
    <div style={{
      margin:'22px auto', maxWidth:440, background:'var(--app-surface)', border:'1px solid var(--app-border)',
      borderRadius:16, boxShadow:'var(--shadow-md)', overflow:'hidden',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:11, padding:'15px 18px', borderBottom:'1px solid var(--app-border)' }}>
        <span style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#a78bfa,#6d28d9)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13 }}>NS</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--app-text)', letterSpacing:-0.1 }}>Northside Studio</div>
          <div style={{ fontSize:11.5, color:'var(--fg3)', marginTop:1 }}>Pick a time that works for you.</div>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>
        {/* event types */}
        <div style={{ padding:'12px 14px', borderRight:'1px solid var(--app-border)', display:'flex', flexDirection:'column', gap:8 }}>
          {[{ n:'Intro call', d:'30 min' }, { n:'Project kickoff', d:'45 min' }, { n:'Design review', d:'30 min' }].map((e, i) => (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:9, padding:'9px 10px', borderRadius:10,
              border:`1px solid ${i === 0 ? VIOLET : 'var(--app-border)'}`,
              background: i === 0 ? 'var(--color-identity-business-bg)' : 'var(--app-surface)',
            }}>
              <Icon name="video" size={14} color={i === 0 ? VIOLET : 'var(--fg3)'}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--app-text)' }}>{e.n}</div>
                <div style={{ fontSize:10, color:'var(--fg3)', marginTop:1 }}>{e.d}</div>
              </div>
            </div>
          ))}
        </div>
        {/* mini calendar */}
        <div style={{ padding:'12px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:11.5, fontWeight:700, color:'var(--app-text)' }}>June</span>
            <span style={{ display:'flex', gap:4 }}>
              <Icon name="chevron-left" size={13} color="var(--fg4)"/>
              <Icon name="chevron-right" size={13} color="var(--fg4)"/>
            </span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
            {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} style={{ textAlign:'center', fontSize:8, fontWeight:700, color:'var(--fg4)' }}>{d}</div>)}
            {Array.from({ length:30 }).map((_, i) => {
              const d = i + 1;
              const avail = [15,16,17,18,19,22,23,24].includes(d);
              const sel = d === 17;
              return (
                <div key={i} style={{
                  textAlign:'center', fontSize:9.5, padding:'3px 0', borderRadius:'50%',
                  background: sel ? VIOLET : 'transparent',
                  color: sel ? '#fff' : avail ? 'var(--app-text)' : 'var(--fg4)',
                  fontWeight: sel ? 700 : avail ? 600 : 400,
                }}>{d}</div>
              );
            })}
          </div>
          <button style={{
            width:'100%', marginTop:10, height:32, borderRadius:8, border:'none', cursor:'pointer',
            background:VIOLET, color:'#fff', fontSize:11.5, fontWeight:700, fontFamily:'inherit',
          }}>Book a call</button>
        </div>
      </div>
    </div>
  );
}

function PreviewPane({ type }) {
  return (
    <BrowserChrome>
      <SiteBackdrop>
        {type === 'inline' && <EmbeddedBooker/>}

        {type === 'popup' && (
          <div style={{ position:'relative', minHeight:374, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:18, padding:'0 40px' }}>
            <div style={{ width:160, height:11, borderRadius:4, background:'var(--app-border-strong)' }}/>
            <div style={{ width:240, height:8, borderRadius:3, background:'var(--app-border)' }}/>
            <button style={{
              marginTop:6, display:'inline-flex', alignItems:'center', gap:8, padding:'13px 24px', borderRadius:12, border:'none',
              cursor:'pointer', background:VIOLET, color:'#fff', fontSize:15, fontWeight:700, fontFamily:'inherit',
              boxShadow:'0 8px 20px rgba(124,58,237,0.28)',
            }}>
              <Icon name="calendar" size={17} color="#fff"/>
              Book a call
            </button>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:6, padding:'6px 11px', borderRadius:9999,
              background:'var(--app-surface)', border:'1px solid var(--app-border)', boxShadow:'var(--shadow-sm)',
              fontSize:11, color:'var(--fg3)', fontWeight:600,
            }}>
              <Icon name="square-mouse-pointer" size={12} color="var(--fg3)"/>
              Opens a booking modal
            </div>
          </div>
        )}

        {type === 'floating' && (
          <div style={{ position:'relative', minHeight:374, padding:'26px 30px' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:11, maxWidth:360 }}>
              <div style={{ width:180, height:13, borderRadius:4, background:'var(--app-border-strong)' }}/>
              {[100, 96, 88, 92].map((w, i) => <div key={i} style={{ width:`${w}%`, height:8, borderRadius:3, background:'var(--app-border)' }}/>)}
              <div style={{ width:120, height:80, borderRadius:10, background:'var(--app-surface-sunken)', border:'1px solid var(--app-border)', marginTop:6 }}/>
            </div>
            {/* floating corner pill */}
            <button style={{
              position:'absolute', right:22, bottom:22, display:'inline-flex', alignItems:'center', gap:8,
              padding:'12px 20px', borderRadius:9999, border:'none', cursor:'pointer',
              background:VIOLET, color:'#fff', fontSize:14, fontWeight:700, fontFamily:'inherit',
              boxShadow:'0 10px 24px rgba(124,58,237,0.34)',
            }}>
              <Icon name="calendar" size={16} color="#fff"/>
              Book a call
            </button>
          </div>
        )}
      </SiteBackdrop>
    </BrowserChrome>
  );
}

// ─── Screen shell ─────────────────────────────────────────────────────────

function Screen({ label, type, colorOpen, copied, children }) {
  return (
    <div style={{
      width:1180, background:'var(--app-bg)', borderRadius:16, overflow:'hidden',
      border:'1px solid var(--app-border)', boxShadow:'0 12px 40px rgba(17,24,39,0.08)',
    }} data-screen-label={label}>
      <AppNav/>
      <div style={{ padding:'30px 36px 40px', position:'relative' }}>
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:25, fontWeight:700, letterSpacing:-0.5, color:'var(--app-text)', margin:0 }}>Embed your booking widget</h1>
          <p style={{ fontSize:14.5, color:'var(--fg3)', margin:'7px 0 0', lineHeight:'21px' }}>Drop your booking flow onto your own site.</p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'start' }}>
          {/* LEFT config */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <EmbedTypeSegment value={type}/>
            {(type === 'popup' || type === 'floating') && <ButtonConfigCard floating={type === 'floating'}/>}
            <AppearanceCard colorOpen={colorOpen}/>
            <SnippetCard type={type} copied={copied}/>
            <WhereItShowsCard/>
          </div>

          {/* RIGHT preview */}
          <div style={{ position:'sticky', top:20 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:11 }}>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--fg3)' }}>Live preview</span>
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11.5, color:'var(--fg3)', fontWeight:600 }}>
                <Icon name="refresh-cw" size={12} color="var(--fg4)"/>
                Updates as you edit
              </span>
            </div>
            <PreviewPane type={type}/>
          </div>
        </div>

        {/* copied toast */}
        {copied && (
          <div style={{
            position:'absolute', bottom:28, left:'50%', transform:'translateX(-50%)',
            display:'inline-flex', alignItems:'center', gap:8, padding:'11px 18px', borderRadius:11,
            background:'var(--color-success-bg)', border:'1px solid #A7F3D0',
            boxShadow:'0 10px 28px rgba(5,150,105,0.2)',
          }}>
            <Icon name="check-circle-2" size={17} color="var(--color-success)" stroke={2.4}/>
            <span style={{ fontSize:13.5, fontWeight:700, color:'var(--color-success)', letterSpacing:-0.1 }}>Snippet copied</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FRAMES ───────────────────────────────────────────────────────────────

function FrameInline()     { return <Screen label="Embed · Inline (default)" type="inline"/>; }
function FramePopup()       { return <Screen label="Embed · Popup button" type="popup"/>; }
function FrameFloating()    { return <Screen label="Embed · Floating button" type="floating"/>; }
function FrameAppearance()  { return <Screen label="Embed · Appearance config" type="inline" colorOpen/>; }
function FrameCopied()      { return <Screen label="Embed · Copied snippet" type="inline" copied/>; }

Object.assign(window, { FrameInline, FramePopup, FrameFloating, FrameAppearance, FrameCopied });
