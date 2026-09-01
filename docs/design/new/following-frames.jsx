// §1A① — src/app/beacons/following.tsx
// "Following" — Beacons (creator personas) the signed-in user follows.
// List-of-Rows archetype · avatar-first rows · grouped by activity.
// Rows tap → A21 Public Beacon profile. Sub-route: tab bar hidden.
// 4 frames: Populated · Row action sheet · Mute sub-step · Empty.

// ── Membership tier pill (primary-100 / primary-700) ─────────────
function TierPill({ label }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:3,
      padding:'1px 7px 1px 5px', borderRadius:9999,
      background:BU.primary100, color:BU.primary700,
      fontSize:10, fontWeight:700, letterSpacing:0.02,
      flexShrink:0, lineHeight:1.5,
    }}>
      <i data-lucide="star" style={{width:9, height:9, strokeWidth:2.5, fill:BU.primary700}}/>
      {label}
    </span>
  );
}

// ── Unread count badge ("3" / "25+") ─────────────────────────────
function UnreadBadge({ count }) {
  return (
    <span style={{
      minWidth:20, height:20, padding:'0 6px', boxSizing:'border-box',
      borderRadius:9999, background:BU.primary600, color:'#fff',
      fontSize:11.5, fontWeight:700, letterSpacing:-0.2,
      display:'inline-flex', alignItems:'center', justifyContent:'center',
    }}>{count}</span>
  );
}

// ── One follow row ───────────────────────────────────────────────
function FollowRow({
  letter, color, name, handle, followers, verified = false,
  tier, snippet, time, unread, muted = false, quiet = false,
}) {
  const dim = muted || quiet;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'11px 12px 11px 14px',
      opacity: muted ? 0.62 : 1,
    }}>
      <BAvatar letter={letter} color={color} verified={verified} size={44} dim={dim}/>

      <div style={{flex:1, minWidth:0}}>
        {/* Line 1 — name + verified + tier */}
        <div style={{display:'flex', alignItems:'center', gap:5, minWidth:0}}>
          <span style={{
            fontSize:14, fontWeight:600, color:BU.fg1, letterSpacing:-0.2,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0,
          }}>{name}</span>
          {verified && (
            <i data-lucide="badge-check" style={{
              width:14, height:14, strokeWidth:2, color:BU.primary600, flexShrink:0,
            }}/>
          )}
          {tier && <TierPill label={tier}/>}
        </div>

        {/* Line 2 — handle · followers */}
        <div style={{
          fontSize:11.5, color:BU.fg3, marginTop:1, letterSpacing:-0.01,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
        }}>{handle} · {followers} followers</div>

        {/* Line 3 — snippet + time (or muted "no updates") */}
        <div style={{display:'flex', alignItems:'baseline', gap:8, marginTop:4}}>
          <span style={{
            flex:1, minWidth:0, fontSize:12, lineHeight:'16px', letterSpacing:-0.05,
            color: quiet ? BU.fg4 : BU.fg2,
            fontStyle: quiet ? 'italic' : 'normal',
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          }}>{quiet ? 'No recent updates' : snippet}</span>
          {time && (
            <span style={{fontSize:11, color:BU.fg4, flexShrink:0, fontWeight:500}}>{time}</span>
          )}
        </div>
      </div>

      {/* Trailing — status indicator + kebab */}
      <div style={{display:'flex', alignItems:'center', gap:4, flexShrink:0}}>
        {unread != null ? (
          <UnreadBadge count={unread}/>
        ) : muted ? (
          <i data-lucide="bell-off" style={{width:16, height:16, strokeWidth:2, color:BU.fg4}}/>
        ) : (
          <i data-lucide="chevron-right" style={{width:18, height:18, strokeWidth:2, color:BU.borderStrong}}/>
        )}
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

// ── Grouped white container w/ inset dividers ────────────────────
function RowGroup({ rows }) {
  return (
    <div style={{
      margin:'0 12px', background:BU.surface, border:`1px solid ${BU.border}`,
      borderRadius:16, overflow:'hidden', boxShadow:BU.shadowSm || '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {rows.map((r, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div style={{height:1, background:BU.borderSub, marginLeft:70}}/>}
          <FollowRow {...r}/>
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Bottom-sheet scaffolding (iOS action-sheet style) ────────────
function BScrim() {
  return <div style={{position:'absolute', inset:0, background:'rgba(17,24,39,0.40)', zIndex:40}}/>;
}
function BSheet({ children }) {
  return (
    <div style={{
      position:'absolute', left:0, right:0, bottom:0, zIndex:45,
      padding:'0 8px 10px', boxSizing:'border-box',
    }}>{children}</div>
  );
}
function SheetCard({ children, style }) {
  return (
    <div style={{
      background:BU.surface, borderRadius:16, overflow:'hidden',
      boxShadow:'0 -2px 20px rgba(17,24,39,0.12)', ...style,
    }}>{children}</div>
  );
}
function SheetRow({ icon, label, sub, destructive, center, bold, trailing, iconFill }) {
  const c = destructive ? BU.error : BU.fg1;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:14,
      padding: center ? '15px 16px' : '14px 16px',
      justifyContent: center ? 'center' : 'flex-start',
    }}>
      {icon && !center && (
        <i data-lucide={icon} style={{width:20, height:20, strokeWidth:2, color:c, flexShrink:0}}/>
      )}
      <div style={{flex: center ? 'none' : 1, minWidth:0}}>
        <div style={{
          fontSize:15.5, fontWeight: bold ? 600 : center ? 600 : 500,
          color:c, letterSpacing:-0.2,
        }}>{label}</div>
        {sub && (
          <div style={{fontSize:12, color:BU.fg3, marginTop:2, letterSpacing:-0.05}}>{sub}</div>
        )}
      </div>
      {trailing}
    </div>
  );
}
function SheetDivider() {
  return <div style={{height:1, background:BU.borderSub, marginLeft:50}}/>;
}
// Context header inside a sheet (who is being acted on)
function SheetContext({ letter, color, name, handle, verified }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:11, padding:'14px 16px',
      borderBottom:`1px solid ${BU.borderSub}`,
    }}>
      <BAvatar letter={letter} color={color} verified={verified} size={38}/>
      <div style={{minWidth:0}}>
        <div style={{fontSize:14, fontWeight:600, color:BU.fg1, letterSpacing:-0.2}}>{name}</div>
        <div style={{fontSize:12, color:BU.fg3, marginTop:1}}>{handle}</div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  DATA
// ════════════════════════════════════════════════════════════════
const NEW_UPDATES = [
  { letter:'M', color:'#D97706', name:'Maple Bakery', handle:'@maplebakery', followers:'1.2k', verified:true,
    tier:'Insiders', snippet:'Croissants are back tomorrow at 7am — first 30 half-off for followers.', time:'2h', unread:3 },
  { letter:'B', color:'#6D28D9', name:'Burnside Library', handle:'@burnsidelib', followers:'3.4k', verified:true,
    snippet:'Toddler story time Saturday — 10am sharp in the kids\u2019 room.', time:'5h', unread:12 },
  { letter:'E', color:'#475569', name:'Elm Park Council', handle:'@elmparkcity', followers:'6.1k', verified:true,
    snippet:'Street sweeping shifts to Thursdays starting next week.', time:'1d', unread:'25+' },
];
const ACTIVE = [
  { letter:'R', color:'#059669', name:'Rae the Plumber', handle:'@raetheplumber', followers:'840', verified:true,
    snippet:'Quick tip: a shower that drips after you shut it off is a $4 cartridge.', time:'2d', muted:true },
  { letter:'S', color:'#0ea5e9', name:'Sami Kim', handle:'@samikim', followers:'412', verified:true,
    snippet:'The new ramen place on 8th is worth the hype. Tonkotsu is the move.', time:'3d' },
];
const QUIET = [
  { letter:'O', color:'#38bdf8', name:'Otis Park', handle:'@otispark', followers:'96', quiet:true },
  { letter:'B', color:'#7C3AED', name:'Bay Ridge Sketch Club', handle:'@bayridgesketch', followers:'220', verified:true, quiet:true },
];

const SORT_OPTS = [
  { key:'activity', label:'Activity' },
  { key:'recent',   label:'Recent' },
  { key:'az',       label:'A\u2013Z' },
  { key:'unread',   label:'Unread' },
];

// ════════════════════════════════════════════════════════════════
//  FRAME 1 — POPULATED
// ════════════════════════════════════════════════════════════════
function FrameFollowingPopulated() {
  return (
    <BPhone>
      <BNavBar title="Following" count="24 Beacons · 3 with updates"/>
      <BSortControl options={SORT_OPTS} activeKey="activity"/>
      <div style={{flex:1, overflow:'auto', background:BU.muted, paddingBottom:18}}>
        <BSectionHeader label="New updates" count="3" tint={BU.primary600}/>
        <RowGroup rows={NEW_UPDATES}/>
        <BSectionHeader label="Active" count="2"/>
        <RowGroup rows={ACTIVE}/>
        <BSectionHeader label="Quiet" count="2"/>
        <RowGroup rows={QUIET}/>
      </div>
    </BPhone>
  );
}

// ════════════════════════════════════════════════════════════════
//  FRAME 2 — ROW ACTION SHEET
// ════════════════════════════════════════════════════════════════
function FrameFollowingActionSheet() {
  return (
    <BPhone>
      <BNavBar title="Following" count="24 Beacons · 3 with updates"/>
      <BSortControl options={SORT_OPTS} activeKey="activity"/>
      <div style={{flex:1, overflow:'hidden', background:BU.muted, paddingBottom:18}}>
        <BSectionHeader label="New updates" count="3" tint={BU.primary600}/>
        <RowGroup rows={NEW_UPDATES}/>
        <BSectionHeader label="Active" count="2"/>
        <RowGroup rows={ACTIVE}/>
      </div>

      <BScrim/>
      <BSheet>
        <SheetCard style={{marginBottom:8}}>
          <SheetContext letter="M" color="#D97706" name="Maple Bakery" handle="@maplebakery" verified/>
          <SheetRow icon="check-check" label="Mark seen"/>
          <SheetDivider/>
          <SheetRow icon="bell-off" label="Mute" sub="No updates while muted"
            trailing={<i data-lucide="chevron-right" style={{width:18, height:18, color:BU.fg4}}/>}/>
          <SheetDivider/>
          <SheetRow icon="user-minus" label="Unfollow" destructive/>
        </SheetCard>
        <SheetCard>
          <SheetRow label="Cancel" center bold/>
        </SheetCard>
      </BSheet>
    </BPhone>
  );
}

// ════════════════════════════════════════════════════════════════
//  FRAME 3 — MUTE SUB-STEP
// ════════════════════════════════════════════════════════════════
function FrameFollowingMute() {
  return (
    <BPhone>
      <BNavBar title="Following" count="24 Beacons · 3 with updates"/>
      <BSortControl options={SORT_OPTS} activeKey="activity"/>
      <div style={{flex:1, overflow:'hidden', background:BU.muted, paddingBottom:18}}>
        <BSectionHeader label="New updates" count="3" tint={BU.primary600}/>
        <RowGroup rows={NEW_UPDATES}/>
        <BSectionHeader label="Active" count="2"/>
        <RowGroup rows={ACTIVE}/>
      </div>

      <BScrim/>
      <BSheet>
        <SheetCard style={{marginBottom:8}}>
          {/* header with back to previous sheet */}
          <div style={{
            display:'flex', alignItems:'center', gap:8, padding:'12px 12px 12px 8px',
            borderBottom:`1px solid ${BU.borderSub}`,
          }}>
            <button aria-label="Back" style={{
              width:32, height:32, borderRadius:'50%', border:'none', background:'transparent',
              cursor:'pointer', color:BU.fg2, display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <i data-lucide="chevron-left" style={{width:21, height:21, strokeWidth:2.2}}/>
            </button>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:14.5, fontWeight:600, color:BU.fg1, letterSpacing:-0.2}}>Mute Maple Bakery</div>
              <div style={{fontSize:12, color:BU.fg3, marginTop:1}}>You can unmute anytime in settings</div>
            </div>
          </div>
          <SheetRow icon="clock" label="For 1 day"/>
          <SheetDivider/>
          <SheetRow icon="clock" label="For 1 week"/>
          <SheetDivider/>
          <SheetRow icon="clock" label="For 30 days"/>
          <SheetDivider/>
          <SheetRow icon="settings-2" label="Custom…" sub="Up to 1 year"
            trailing={<i data-lucide="chevron-right" style={{width:18, height:18, color:BU.fg4}}/>}/>
        </SheetCard>
        <SheetCard>
          <SheetRow label="Cancel" center bold/>
        </SheetCard>
      </BSheet>
    </BPhone>
  );
}

// ════════════════════════════════════════════════════════════════
//  FRAME 4 — EMPTY
// ════════════════════════════════════════════════════════════════
function FrameFollowingEmpty() {
  return (
    <BPhone>
      <BNavBar title="Following" count="0 Beacons"/>
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
          <i data-lucide="radio-tower" style={{width:34, height:34, strokeWidth:1.7}}/>
        </div>
        <h2 style={{margin:0, fontSize:20, fontWeight:700, color:BU.fg1, letterSpacing:-0.3, lineHeight:1.25}}>
          You’re not following<br/>any Beacons yet
        </h2>
        <p style={{margin:0, fontSize:13.5, color:BU.fg3, lineHeight:'20px', maxWidth:262, letterSpacing:-0.05}}>
          Follow Beacons — verified people, businesses, and civic accounts — to get their updates here.
        </p>
        <button style={{
          marginTop:8, height:46, padding:'0 24px', borderRadius:9999, border:'none',
          background:BU.primary600, color:'#fff', cursor:'pointer',
          fontSize:14.5, fontWeight:700, letterSpacing:-0.1,
          display:'inline-flex', alignItems:'center', gap:8,
          boxShadow:'0 8px 18px rgba(2,132,199,0.30)',
        }}>
          <i data-lucide="compass" style={{width:16, height:16, strokeWidth:2.4}}/>
          Discover Beacons
        </button>

        <div style={{
          marginTop:22, padding:'10px 14px', borderRadius:10,
          background:BU.surface, border:`1px solid ${BU.border}`,
          display:'inline-flex', alignItems:'center', gap:8, color:BU.fg3,
          fontSize:11.5, fontWeight:500, maxWidth:288,
        }}>
          <i data-lucide="sparkles" style={{width:13, height:13, color:BU.primary600}}/>
          <span>12 Beacons active near <strong style={{color:BU.fg2, fontWeight:700}}>Elm Park</strong></span>
        </div>
      </div>
    </BPhone>
  );
}

Object.assign(window, {
  FrameFollowingPopulated, FrameFollowingActionSheet, FrameFollowingMute, FrameFollowingEmpty,
});
