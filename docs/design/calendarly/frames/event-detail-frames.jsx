// F2 — Home Event Detail (existing, extended for RSVP) · 300×620 · Home green
// Frames: loaded · loading · error · deleting · offline · RSVP-pending · RSVP-recorded

const { N, H, CAT, M } = window;
const { Phone, TopBar, Card, Overline, Avatar, CatChip, Segmented,
        PrimaryBtn, SecondaryBtn, TextBtn, StickyFooter, Banner, Shimmer, Dialog, DetailRow } = window;

// ── RSVP pill ─────────────────────────────────────────────────
function RsvpPill({ state }) {
  const map = {
    going:  { bg:N.successBg, fg:'#047857', icon:'check', label:'Going' },
    maybe:  { bg:N.warningBg, fg:N.warning700, icon:'help-circle', label:'Maybe' },
    cant:   { bg:N.errorBg, fg:'#b91c1c', icon:'x', label:"Can't" },
    none:   { bg:N.sunken, fg:N.fg3, icon:'minus', label:'No reply' },
  }[state];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:9999, background:map.bg, color:map.fg, fontSize:10.5, fontWeight:700 }}>
      <i data-lucide={map.icon} style={{ width:11, height:11, strokeWidth:2.6 }}/>{map.label}
    </span>
  );
}

function AttendeeRow({ m, rsvp, last, you }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 2px', borderBottom: last?'none':`1px solid ${N.border}` }}>
      <Avatar m={m} size={30}/>
      <div style={{ flex:1, minWidth:0, fontSize:13, fontWeight:600, color:N.fg1 }}>{m.full}{you && <span style={{ color:N.fg4, fontWeight:600 }}> · you</span>}</div>
      <RsvpPill state={rsvp}/>
    </div>
  );
}

const ATTENDEES = [
  { m:M.mom, rsvp:'going' },
  { m:M.dad, rsvp:'going' },
  { m:M.ava, rsvp:'maybe' },
  { m:{ name:'Gran', full:'Grandma Ola', initials:'GO', grad:'linear-gradient(135deg, #c084fc, #7c3aed)' }, rsvp:'cant' },
  { m:M.tom, rsvp:'none' },
];

function EventHeader() {
  return (
    <div style={{ padding:'14px 14px 2px' }}>
      <h2 style={{ margin:0, fontSize:21, fontWeight:700, color:N.fg1, letterSpacing:-0.4, lineHeight:'26px' }}>Family dinner</h2>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
        <span style={{ fontSize:13, fontWeight:600, color:N.fg2 }}>Mon Jun 16 · 6:30 PM</span>
        <CatChip cat="meal"/>
      </div>
    </div>
  );
}

function DetailGrid() {
  return (
    <Card pad="4px 13px">
      <DetailRow icon="repeat" label="Repeats" value="Every Monday"/>
      <DetailRow icon="bell" label="Reminder" value="1 hour before · 10 min before"/>
      <DetailRow icon="map-pin" label="Location" value="Kitchen"/>
      <DetailRow icon="tag" label="Type" value="Meals" last/>
    </Card>
  );
}

function YourRsvp({ value, recorded }) {
  return (
    <Card>
      <Overline color={H.accent700}>Your RSVP</Overline>
      {recorded ? (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'2px 0' }}>
          <div style={{ width:34, height:34, borderRadius:'50%', background:N.successBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i data-lucide="check" style={{ width:18, height:18, color:N.success, strokeWidth:2.6 }}/></div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13.5, fontWeight:700, color:N.fg1 }}>You're going</div>
            <div style={{ fontSize:11, color:N.fg3, marginTop:1 }}>Everyone can see your reply</div>
          </div>
          <TextBtn tone={H.accent700} icon="pencil">Change</TextBtn>
        </div>
      ) : (
        <Segmented options={['Going', 'Maybe', "Can't"]} value={value} full/>
      )}
    </Card>
  );
}

function NotesCard() {
  return (
    <Card>
      <Overline>Notes</Overline>
      <div style={{ fontSize:12.5, color:N.fg2, lineHeight:'18px' }}>Ava has soccer until 6. Gran is bringing dessert. Let's eat by 7 so homework gets done.</div>
    </Card>
  );
}

function DetailBody({ children, dim }) {
  return <div style={{ flex:1, overflow:'auto', padding:'0 12px 92px', display:'flex', flexDirection:'column', gap:11, opacity:dim?0.55:1 }}>{children}</div>;
}

// ─── FRAME 1 · LOADED ──────────────────────────────────────────
function FrameLoaded() {
  return (
    <Phone label="Event detail · Loaded">
      <TopBar title="Event" right={{ text:'Edit' }}/>
      <EventHeader/>
      <DetailBody>
        <DetailGrid/>
        <Card>
          <Overline>Attendees</Overline>
          {ATTENDEES.map((a, i) => <AttendeeRow key={i} {...a} last={i===ATTENDEES.length-1}/>)}
        </Card>
        <YourRsvp value={null}/>
        <NotesCard/>
      </DetailBody>
      <StickyFooter>
        <div style={{ flex:1 }}><SecondaryBtn icon="pencil">Edit</SecondaryBtn></div>
        <TextBtn tone={N.error} icon="trash-2">Delete</TextBtn>
      </StickyFooter>
    </Phone>
  );
}

// ─── FRAME 2 · LOADING ─────────────────────────────────────────
function FrameLoading() {
  return (
    <Phone label="Event detail · Loading">
      <TopBar title="Event" right={{ text:'Edit', muted:true }}/>
      <div style={{ padding:'14px 14px 4px' }}><Shimmer w="60%" h={22} r={7}/><Shimmer w="45%" h={12} style={{ marginTop:10 }}/></div>
      <DetailBody>
        <Card><div style={{ display:'flex', flexDirection:'column', gap:13, padding:'4px 0' }}>{[0,1,2,3].map(i => <div key={i} style={{ display:'flex', alignItems:'center', gap:11 }}><Shimmer w={30} h={30} r={8}/><div style={{ flex:1 }}><Shimmer w="40%" h={8}/><Shimmer w="65%" h={11} style={{ marginTop:6 }}/></div></div>)}</div></Card>
        <Card><Shimmer w={70} h={9}/><div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:11 }}>{[0,1,2].map(i => <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}><Shimmer w={30} h={30} r={15}/><Shimmer w="40%" h={11}/><div style={{ flex:1 }}/><Shimmer w={54} h={18} r={9}/></div>)}</div></Card>
      </DetailBody>
    </Phone>
  );
}

// ─── FRAME 3 · ERROR ───────────────────────────────────────────
function FrameError() {
  return (
    <Phone label="Event detail · Error">
      <TopBar title="Event"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', padding:'24px 28px' }}>
        <div style={{ width:56, height:56, borderRadius:'50%', background:N.errorBg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}><i data-lucide="cloud-off" style={{ width:26, height:26, color:N.error }}/></div>
        <div style={{ fontSize:15.5, fontWeight:700, color:N.fg1 }}>Couldn't load this event</div>
        <div style={{ fontSize:12.5, color:N.fg3, lineHeight:'18px', maxWidth:220, marginTop:5 }}>It may have been deleted, or your connection dropped.</div>
        <div style={{ marginTop:16, width:160 }}><PrimaryBtn icon="rotate-cw">Retry</PrimaryBtn></div>
      </div>
    </Phone>
  );
}

// ─── FRAME 4 · DELETING (confirm dialog) ───────────────────────
function FrameDeleting() {
  return (
    <Phone label="Event detail · Deleting" indicatorLight>
      <TopBar title="Event" right={{ text:'Edit', muted:true }}/>
      <DetailBody dim>
        <EventHeader/>
        <DetailGrid/>
      </DetailBody>
      <Dialog icon="trash-2" tone="error" title="Delete this event?" body="This can't be undone. Attendees won't see it on the calendar anymore.">
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          <button style={{ width:'100%', height:44, borderRadius:12, border:'none', background:N.error, color:'#fff', fontSize:13.5, fontWeight:700, cursor:'pointer' }}>Delete</button>
          <button style={{ width:'100%', height:44, borderRadius:12, border:`1px solid ${N.borderStrong}`, background:N.surface, color:N.fg2, fontSize:13.5, fontWeight:700, cursor:'pointer' }}>Keep</button>
        </div>
      </Dialog>
    </Phone>
  );
}

// ─── FRAME 5 · OFFLINE ─────────────────────────────────────────
function FrameOffline() {
  return (
    <Phone label="Event detail · Offline">
      <TopBar title="Event" right={{ text:'Edit', muted:true }}/>
      <div style={{ padding:'10px 12px 0' }}><Banner tone="amber" icon="wifi-off" title="You're offline">RSVP buttons are disabled until you reconnect.</Banner></div>
      <DetailBody>
        <EventHeader/>
        <Card>
          <Overline>Attendees</Overline>
          {ATTENDEES.slice(0,3).map((a, i) => <AttendeeRow key={i} {...a} last={i===2}/>)}
        </Card>
        <Card>
          <Overline color={N.fg4}>Your RSVP</Overline>
          <div style={{ opacity:0.5, pointerEvents:'none' }}><Segmented options={['Going', 'Maybe', "Can't"]} value={null} full/></div>
        </Card>
      </DetailBody>
    </Phone>
  );
}

// ─── FRAME 6 · RSVP-PENDING ────────────────────────────────────
function FramePending() {
  return (
    <Phone label="Event detail · RSVP-pending">
      <TopBar title="Event" right={{ text:'Edit' }}/>
      <EventHeader/>
      <DetailBody>
        <Card>
          <Overline>Attendees</Overline>
          {ATTENDEES.slice(0,3).map((a, i) => <AttendeeRow key={i} {...a} last={i===2}/>)}
        </Card>
        <div style={{ background:N.surface, border:`1.5px solid ${H.accent}`, borderRadius:16, boxShadow:`0 0 0 4px ${H.bg50}`, padding:13, display:'flex', flexDirection:'column', gap:9 }}>
          <Overline color={H.accent700}>Your RSVP</Overline>
          <Segmented options={['Going', 'Maybe', "Can't"]} value={null} full/>
          <div style={{ fontSize:11, color:H.accent700, fontWeight:600, display:'flex', alignItems:'center', gap:5 }}><i data-lucide="hand" style={{ width:12, height:12 }}/>Tap to let everyone know</div>
        </div>
        <NotesCard/>
      </DetailBody>
      <StickyFooter>
        <div style={{ flex:1 }}><SecondaryBtn icon="pencil">Edit</SecondaryBtn></div>
        <TextBtn tone={N.error} icon="trash-2">Delete</TextBtn>
      </StickyFooter>
    </Phone>
  );
}

// ─── FRAME 7 · RSVP-RECORDED ───────────────────────────────────
function FrameRecorded() {
  const att = [{ m:M.mom, rsvp:'going' }, { m:{ name:'You', full:'You', initials:'YO', grad:'linear-gradient(135deg, #34d399, #16a34a)' }, rsvp:'going', you:true }, { m:M.dad, rsvp:'going' }, { m:M.ava, rsvp:'maybe' }];
  return (
    <Phone label="Event detail · RSVP-recorded">
      <TopBar title="Event" right={{ text:'Edit' }}/>
      <EventHeader/>
      <DetailBody>
        <Card>
          <Overline>Attendees</Overline>
          {att.map((a, i) => <AttendeeRow key={i} {...a} last={i===att.length-1}/>)}
        </Card>
        <YourRsvp recorded/>
        <NotesCard/>
      </DetailBody>
      <StickyFooter>
        <div style={{ flex:1 }}><SecondaryBtn icon="pencil">Edit</SecondaryBtn></div>
        <TextBtn tone={N.error} icon="trash-2">Delete</TextBtn>
      </StickyFooter>
    </Phone>
  );
}

Object.assign(window, { FrameLoaded, FrameLoading, FrameError, FrameDeleting, FrameOffline, FramePending, FrameRecorded });
