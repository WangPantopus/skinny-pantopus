// A14.4 — Blocked users (src/app/settings/blocked-users.tsx)
// People-listing variant of the A14 archetype. Same card chrome and row
// chrome; row carries an avatar (leading), name (label), blocked date (sub),
// and an Unblock pill button (right). Single unlabeled card — overline
// would be redundant with the screen title.

const BLOCKED = [
  { name:'Greg Anders',      date:'Blocked Apr 3, 2024',  ctx:'from Tasks' },
  { name:'Priya Sengupta',   date:'Blocked Feb 19, 2024', ctx:'from Pulse' },
  { name:'Tomás Rivera',     date:'Blocked Jan 28, 2024', ctx:'from Marketplace' },
  { name:'Annika Bauer',     date:'Blocked Nov 12, 2023', ctx:'from Chat' },
  { name:'Devon Khoury',     date:'Blocked Sep 7, 2023',  ctx:'from Tasks' },
];

function FrameBlockedPopulated() {
  return (
    <Phone>
      <TopBar title="Blocked users"/>
      <div style={{flex:1, overflow:'auto', paddingBottom:24}}>
        <Overline>Blocked · {BLOCKED.length}</Overline>
        <Card helper="Blocked people can't message you, see your profile, or bid on your tasks. Unblocking doesn't notify them.">
          {BLOCKED.map((u, i) => (
            <Row
              key={i}
              padY={12}
              leading={<Avatar name={u.name}/>}
              label={u.name}
              sub={`${u.date} · ${u.ctx}`}
              right={<PillButton>Unblock</PillButton>}
            />
          ))}
        </Card>

        <MonoFooter>Maria Lewin · ID 8174</MonoFooter>
      </div>
    </Phone>
  );
}

function FrameBlockedEmpty() {
  return (
    <Phone>
      <TopBar title="Blocked users"/>
      <EmptyState
        icon="user-x"
        title="No one blocked"
        body="When you block someone, they'll appear here. They won't be notified, and you can unblock them anytime."
      />
    </Phone>
  );
}

Object.assign(window, { FrameBlockedPopulated, FrameBlockedEmpty });
