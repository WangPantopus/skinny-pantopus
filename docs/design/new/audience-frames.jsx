// A22.2 — src/app/audience/members.tsx
// "Your audience" — a creator's view of their Beacon's fans/members.
// Sibling of A22.1 Audience (broadcast hub); reuses A10.8 tier-card styling
// for member rows. List-of-Rows archetype: pending-requests section above
// tier-grouped active members. Sub-route: back chevron, no tab bar.
// 4 frames: Populated · Filtered to Pending · Full-empty · Inline no-pending.

// ── Tier tokens (creator-named tiers map to rank colors) ─────────
const TIER = {
  vip:        { name:'VIP',        color:'#C29230', bg:'#F4E2A8', on:'#2A1F0A', icon:'crown' },
  insiders:   { name:'Insiders',   color:'#8C95A1', bg:'#DDE2E8', on:'#ffffff', icon:'star'  },
  supporters: { name:'Supporters', color:'#6B7C8A', bg:'#E6ECF1', on:'#ffffff', icon:'heart' },
};

function ATierPill({ tier }) {
  const t = TIER[tier];
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:3,
      padding:'1px 7px 1px 5px', borderRadius:9999,
      background:t.bg, color:t.color,
      fontSize:10, fontWeight:700, letterSpacing:0.02,
      flexShrink:0, lineHeight:1.5,
    }}>
      <i data-lucide={t.icon} style={{width:9, height:9, strokeWidth:2.5, fill:t.color}}/>
      {t.name}
    </span>
  );
}

// ── "Local" verified badge (success / map-pin) ───────────────────
function LocalBadge() {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:2.5,
      padding:'1px 6px 1px 4px', borderRadius:9999,
      background:BU.successBg, color:BU.success,
      fontSize:9.5, fontWeight:700, letterSpacing:0.02,
      flexShrink:0, lineHeight:1.6,
    }}>
      <i data-lucide="map-pin" style={{width:9, height:9, strokeWidth:2.6}}/>
      Local
    </span>
  );
}

// ── Filter chip row (All · Pending · per-tier) ───────────────────
function AFilterChips({ chips, activeKey }) {
  return (
    <div style={{
      display:'flex', gap:8, overflowX:'auto', padding:'12px 16px',
      background:BU.muted, flexShrink:0, borderBottom:`1px solid ${BU.border}`,
    }}>
      {chips.map((c) => {
        const active = c.key === activeKey;
        return (
          <button key={c.key} style={{
            height:30, padding:'0 13px', borderRadius:9999,
            background: active ? BU.primary600 : BU.surface,
            color: active ? '#fff' : BU.fg2,
            border: active ? 'none' : `1px solid ${BU.border}`,
            fontSize:12.5, fontWeight:600, letterSpacing:-0.05,
            cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
            display:'inline-flex', alignItems:'center', gap:5,
          }}>
            {c.label}
            {c.count != null && (
              <span style={{
                fontWeight:700,
                color: active ? 'rgba(255,255,255,0.85)' : BU.fg4,
              }}>&middot; {c.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Pending request row (Approve / Decline) ──────────────────────
function PendingRow({ letter, color, name, handle, local, tier, ago }) {
  return (
    <div style={{padding:'12px 14px'}}>
      <div style={{display:'flex', alignItems:'center', gap:12}}>
        <BAvatar letter={letter} color={color} size={44}/>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', alignItems:'center', gap:5, minWidth:0}}>
            <span style={{
              fontSize:14, fontWeight:600, color:BU.fg1, letterSpacing:-0.2,
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0,
            }}>{name}</span>
            {local && <LocalBadge/>}
          </div>
          <div style={{fontSize:11.5, color:BU.fg3, marginTop:1, letterSpacing:-0.01}}>{handle}</div>
          <div style={{display:'flex', alignItems:'center', gap:7, marginTop:5}}>
            <ATierPill tier={tier}/>
            <span style={{fontSize:11, color:BU.fg4, fontWeight:500}}>requested {ago}</span>
          </div>
        </div>
      </div>
      <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:10}}>
        <button style={{
          height:32, padding:'0 16px', borderRadius:9999, cursor:'pointer',
          background:BU.surface, color:BU.fg2, border:`1px solid ${BU.borderStrong}`,
          fontSize:12.5, fontWeight:600, letterSpacing:-0.1,
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5,
        }}>
          <i data-lucide="x" style={{width:14, height:14, strokeWidth:2.6}}/>
          Decline
        </button>
        <button style={{
          height:32, padding:'0 18px', borderRadius:9999, border:'none', cursor:'pointer',
          background:BU.primary600, color:'#fff', fontSize:12.5, fontWeight:700, letterSpacing:-0.1,
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5,
          boxShadow:'0 2px 6px rgba(2,132,199,0.22)',
        }}>
          <i data-lucide="check" style={{width:14, height:14, strokeWidth:3}}/>
          Approve
        </button>
      </div>
    </div>
  );
}

// ── Active member row (overflow kebab) ───────────────────────────
function MemberRow({ letter, color, name, handle, local, since, muted = false }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:12, padding:'11px 12px 11px 14px'}}>
      <BAvatar letter={letter} color={color} size={44}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:'flex', alignItems:'center', gap:5, minWidth:0}}>
          <span style={{
            fontSize:14, fontWeight:600, color:BU.fg1, letterSpacing:-0.2,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0,
          }}>{name}</span>
          {local && <LocalBadge/>}
        </div>
        <div style={{fontSize:11.5, color:BU.fg3, marginTop:1, letterSpacing:-0.01}}>{handle}</div>
        <div style={{fontSize:11, color:BU.fg4, marginTop:4, fontWeight:500, letterSpacing:-0.01}}>
          Member since {since}
        </div>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:4, flexShrink:0}}>
        {muted && <i data-lucide="bell-off" style={{width:16, height:16, strokeWidth:2, color:BU.fg4}}/>}
        <button aria-label="More" style={{
          width:28, height:28, borderRadius:'50%', border:'none', background:'transparent',
          cursor:'pointer', color:BU.fg4, display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <i data-lucide="more-horizontal" style={{width:18, height:18, strokeWidth:2}}/>
        </button>
      </div>
    </div>
  );
}

// ── Grouped white container with inset dividers ──────────────────
function AGroup({ children }) {
  const items = React.Children.toArray(children);
  return (
    <div style={{
      margin:'0 12px', background:BU.surface, border:`1px solid ${BU.border}`,
      borderRadius:16, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div style={{height:1, background:BU.borderSub, marginLeft:70}}/>}
          {child}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Inline "no pending requests" message (inside a group slot) ───
function InlineEmpty({ icon, text }) {
  return (
    <div style={{
      margin:'0 12px', padding:'18px 16px', borderRadius:16,
      background:BU.surface, border:`1px dashed ${BU.borderStrong}`,
      display:'flex', alignItems:'center', justifyContent:'center', gap:9,
      color:BU.fg3,
    }}>
      <i data-lucide={icon} style={{width:16, height:16, strokeWidth:2, color:BU.fg4}}/>
      <span style={{fontSize:13, fontWeight:500, letterSpacing:-0.05}}>{text}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  DATA
// ════════════════════════════════════════════════════════════════
const PENDING = [
  { letter:'D', color:'#0ea5e9', name:'Dana Reyes',  handle:'@danareyes',  local:true,  tier:'insiders', ago:'2d ago' },
  { letter:'M', color:'#f97316', name:'Marcus Lee',  handle:'@marcuslee',  local:false, tier:'vip',      ago:'5h ago' },
];
const VIP_MEMBERS = [
  { letter:'P', color:'#7C3AED', name:'Priya Nair', handle:'@priyanair', local:true,  since:'Jan 2025' },
  { letter:'T', color:'#475569', name:'Tom Becker', handle:'@tombecker', local:false, since:'Nov 2024', muted:true },
];
const INSIDER_MEMBERS = [
  { letter:'S', color:'#38bdf8', name:'Sana Ortiz', handle:'@sanaortiz', local:true,  since:'Mar 2025' },
  { letter:'O', color:'#059669', name:'Otis Park',  handle:'@otispark',  local:false, since:'Apr 2025' },
  { letter:'L', color:'#D97706', name:'Lena Cho',   handle:'@lenacho',   local:true,  since:'May 2025' },
];

const FILTER_CHIPS = [
  { key:'all',      label:'All' },
  { key:'pending',  label:'Pending',   count:2 },
  { key:'vip',      label:'VIP',       count:2 },
  { key:'insiders', label:'Insiders',  count:3 },
];

// ════════════════════════════════════════════════════════════════
//  FRAME 1 — POPULATED
// ════════════════════════════════════════════════════════════════
function FrameAudiencePopulated() {
  return (
    <BPhone>
      <BNavBar title="Your audience" count="5 members · 2 pending"/>
      <AFilterChips chips={FILTER_CHIPS} activeKey="all"/>
      <div style={{flex:1, overflow:'auto', background:BU.muted, paddingBottom:18}}>
        <BSectionHeader label="Pending requests" count="2" tint={BU.amber}/>
        <AGroup>
          {PENDING.map((p, i) => <PendingRow key={i} {...p}/>)}
        </AGroup>

        <BSectionHeader label="VIP" count="2" tint={TIER.vip.color}/>
        <AGroup>
          {VIP_MEMBERS.map((m, i) => <MemberRow key={i} {...m}/>)}
        </AGroup>

        <BSectionHeader label="Insiders" count="3" tint={TIER.insiders.color}/>
        <AGroup>
          {INSIDER_MEMBERS.map((m, i) => <MemberRow key={i} {...m}/>)}
        </AGroup>
      </div>
    </BPhone>
  );
}

// ════════════════════════════════════════════════════════════════
//  FRAME 2 — FILTERED TO PENDING
// ════════════════════════════════════════════════════════════════
function FrameAudiencePending() {
  return (
    <BPhone>
      <BNavBar title="Your audience" count="5 members · 2 pending"/>
      <AFilterChips chips={FILTER_CHIPS} activeKey="pending"/>
      <div style={{flex:1, overflow:'auto', background:BU.muted, paddingBottom:18}}>
        <BSectionHeader label="Pending requests" count="2" tint={BU.amber}/>
        <AGroup>
          {PENDING.map((p, i) => <PendingRow key={i} {...p}/>)}
        </AGroup>
        <div style={{
          margin:'16px 20px 0', textAlign:'center', fontSize:12, color:BU.fg4,
          lineHeight:'17px', letterSpacing:-0.03,
        }}>
          Approve to add someone to their requested tier. Declining is silent — they aren’t notified.
        </div>
      </div>
    </BPhone>
  );
}

// ════════════════════════════════════════════════════════════════
//  FRAME 3 — FULL EMPTY (no audience yet)
// ════════════════════════════════════════════════════════════════
function FrameAudienceEmpty() {
  return (
    <BPhone>
      <BNavBar title="Your audience" count="0 members"/>
      <div style={{
        flex:1, overflow:'hidden', background:BU.muted,
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', textAlign:'center', padding:'24px 28px 80px', gap:14,
      }}>
        <div style={{
          width:76, height:76, borderRadius:'50%', background:BU.primary50,
          display:'flex', alignItems:'center', justifyContent:'center',
          color:BU.primary600, marginBottom:2,
        }}>
          <i data-lucide="users-round" style={{width:33, height:33, strokeWidth:1.7}}/>
        </div>
        <h2 style={{margin:0, fontSize:20, fontWeight:700, color:BU.fg1, letterSpacing:-0.3, lineHeight:1.25}}>
          No audience yet
        </h2>
        <p style={{margin:0, fontSize:13.5, color:BU.fg3, lineHeight:'20px', maxWidth:250, letterSpacing:-0.05}}>
          When people follow your Beacon, they’ll appear here — and join requests land at the top to approve.
        </p>
        <button style={{
          marginTop:8, height:46, padding:'0 24px', borderRadius:9999, border:'none',
          background:BU.primary600, color:'#fff', cursor:'pointer',
          fontSize:14.5, fontWeight:700, letterSpacing:-0.1,
          display:'inline-flex', alignItems:'center', gap:8,
          boxShadow:'0 8px 18px rgba(2,132,199,0.30)',
        }}>
          <i data-lucide="share-2" style={{width:16, height:16, strokeWidth:2.4}}/>
          Share your Beacon
        </button>

        <div style={{
          marginTop:22, padding:'10px 14px', borderRadius:10,
          background:BU.surface, border:`1px solid ${BU.border}`,
          display:'inline-flex', alignItems:'center', gap:8, color:BU.fg3,
          fontSize:11.5, fontWeight:500, maxWidth:288,
        }}>
          <i data-lucide="megaphone" style={{width:13, height:13, color:BU.primary600}}/>
          <span>Post a broadcast to get discovered nearby</span>
        </div>
      </div>
    </BPhone>
  );
}

// ════════════════════════════════════════════════════════════════
//  FRAME 4 — INLINE EMPTY (no pending, members present)
// ════════════════════════════════════════════════════════════════
function FrameAudienceNoPending() {
  return (
    <BPhone>
      <BNavBar title="Your audience" count="5 members · 0 pending"/>
      <AFilterChips chips={[
        { key:'all', label:'All' },
        { key:'pending', label:'Pending', count:0 },
        { key:'vip', label:'VIP', count:2 },
        { key:'insiders', label:'Insiders', count:3 },
      ]} activeKey="all"/>
      <div style={{flex:1, overflow:'auto', background:BU.muted, paddingBottom:18}}>
        <BSectionHeader label="Pending requests" count="0" tint={BU.amber}/>
        <InlineEmpty icon="inbox" text="No pending requests"/>

        <BSectionHeader label="VIP" count="2" tint={TIER.vip.color}/>
        <AGroup>
          {VIP_MEMBERS.map((m, i) => <MemberRow key={i} {...m}/>)}
        </AGroup>

        <BSectionHeader label="Insiders" count="3" tint={TIER.insiders.color}/>
        <AGroup>
          {INSIDER_MEMBERS.map((m, i) => <MemberRow key={i} {...m}/>)}
        </AGroup>
      </div>
    </BPhone>
  );
}

Object.assign(window, {
  FrameAudiencePopulated, FrameAudiencePending, FrameAudienceEmpty, FrameAudienceNoPending,
});
