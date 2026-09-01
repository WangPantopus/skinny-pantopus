// A14.2 — Security (src/app/homes/[id]/settings/security.tsx)
// Toggle-heavy variant. Three groups, three helpers per group.
// Two frames: balanced setup (populated) · strict / lockdown (secondary state)

function SecurityFrame({ values, helpers }) {
  const access = [
    { l:'Guest approval', sub:'Ask before letting in new passes', k:'guestApproval' },
    { l:'Auto-expire passes', sub:'24h after last use', k:'autoExpire' },
    { l:'Require unique entry code', sub:'One code per guest, never shared', k:'uniqueCode' },
  ];
  const privacy = [
    { l:'Hide address from public profile', k:'hideAddress' },
    { l:'Hide member names', sub:'Show only your home name to outsiders', k:'hideMembers' },
    { l:'Hide from neighbor search', k:'hideSearch' },
  ];
  const docs = [
    { l:'Lock docs', sub:'Require unlock to view household docs', k:'lockDocs' },
    { l:'Require biometric', sub:'Face ID before opening any doc', k:'biometric' },
    { l:'Hide previews in chat', sub:'Doc thumbnails appear blurred until tapped', k:'hidePreviews' },
  ];

  return (
    <Phone>
      <TopBar title="Security"/>
      <div style={{flex:1, overflow:'auto', paddingBottom:24}}>
        <Overline>Access control</Overline>
        <Card helper={helpers.access}>
          {access.map((r,i) => (
            <Row key={i} label={r.l} sub={r.sub} right={<Toggle on={values[r.k]}/>}/>
          ))}
        </Card>

        <Overline>Privacy</Overline>
        <Card helper={helpers.privacy}>
          {privacy.map((r,i) => (
            <Row key={i} label={r.l} sub={r.sub} right={<Toggle on={values[r.k]}/>}/>
          ))}
        </Card>

        <Overline>Documents</Overline>
        <Card helper={helpers.docs}>
          {docs.map((r,i) => (
            <Row key={i} label={r.l} sub={r.sub} right={<Toggle on={values[r.k]}/>}/>
          ))}
        </Card>

        <MonoFooter>14 Elm Park Lane · Last audit 2h ago</MonoFooter>
      </div>
    </Phone>
  );
}

function FrameSecurityPopulated() {
  return (
    <SecurityFrame
      values={{
        guestApproval: true,
        autoExpire: true,
        uniqueCode: false,
        hideAddress: false,
        hideMembers: true,
        hideSearch: false,
        lockDocs: true,
        biometric: true,
        hidePreviews: false,
      }}
      helpers={{
        access: 'Pantopus will ask before letting in new guests.',
        privacy: 'Visible to verified neighbors only. Address used for deliveries.',
        docs: 'Docs unlock with Face ID. Previews still appear in chat.',
      }}
    />
  );
}

// Secondary state: "Strict" / lockdown — every toggle on, helpers show
// downstream consequences. Same archetype, full saturation.
function FrameSecurityLockdown() {
  return (
    <SecurityFrame
      values={{
        guestApproval: true, autoExpire: true, uniqueCode: true,
        hideAddress: true, hideMembers: true, hideSearch: true,
        lockDocs: true, biometric: true, hidePreviews: true,
      }}
      helpers={{
        access: 'All guest activity requires your explicit approval. 3 active passes will re-prompt.',
        privacy: 'Address hidden. 2 pending deliveries may be delayed until shared.',
        docs: 'All docs require Face ID. Previews hidden everywhere, including notifications.',
      }}
    />
  );
}

Object.assign(window, { FrameSecurityPopulated, FrameSecurityLockdown });
