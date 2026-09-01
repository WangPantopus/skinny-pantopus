// A14.1 — Home settings (src/app/homes/[id]/settings/index.tsx)
// Grouped chevron-row settings index for an individual home context.
// Two frames: established home (populated) · newly claimed (verification pending)

function FrameHomeSettingsPopulated() {
  return (
    <Phone>
      <TopBar title="Home settings"/>
      <div style={{flex:1, overflow:'auto', paddingBottom:24}}>
        <Overline>Home</Overline>
        <Card>
          <Row label="Home name" sub="14 Elm Park Lane" right={<Chevron/>}/>
          <Row label="Address" right={
            <ChipChevron>
              <Chip tone="success" icon="shield-check">Verified</Chip>
            </ChipChevron>
          }/>
          <Row label="Photo" sub="Front porch · added Mar 2024" right={<Chevron/>}/>
        </Card>

        <Overline>Access</Overline>
        <Card helper="Manage who can enter and how packages are received.">
          <Row label="Keys & codes" sub="2 active codes" right={<Chevron/>}/>
          <Row label="Package delivery" sub="Side gate · leave inside porch" right={<Chevron/>}/>
          <Row label="Trusted neighbors" sub="3 approved" right={<Chevron/>}/>
        </Card>

        <Overline>Members</Overline>
        <Card>
          <Row label="Household" sub="4 people · you, Tom +2" right={<Chevron/>}/>
          <Row label="Roles & permissions" right={<Chevron/>}/>
          <Row label="Pending invites" sub="1 awaiting reply" right={<Chevron/>}/>
        </Card>

        <Overline>Notifications</Overline>
        <Card>
          <Row label="Notification preferences" sub="Push, email digest" right={<Chevron/>}/>
          <Row label="Quiet hours" sub="10:00 p.m. – 7:00 a.m." right={<Chevron/>}/>
          <Row label="Emergency contacts" sub="2 set" right={<Chevron/>}/>
        </Card>

        <div style={{height:18}}/>
        <Card>
          <Row label="Leave home" destructive/>
        </Card>

        <MonoFooter>14 Elm Park Lane · Owner since Jul 2024</MonoFooter>
      </div>
    </Phone>
  );
}

// Secondary state: home just claimed, verification + setup still pending.
// Same archetype scaffold; rows carry "Action needed" warning chips and
// placeholder subs ("Not set", "Mail in transit") instead of populated values.
function FrameHomeSettingsPending() {
  return (
    <Phone>
      <TopBar title="Home settings"/>
      <div style={{flex:1, overflow:'auto', paddingBottom:24}}>
        <Overline>Home</Overline>
        <Card helper="Verification mail was sent on May 24. It usually arrives in 5–7 days.">
          <Row label="Home name" sub="42 Magnolia Court" right={<Chevron/>}/>
          <Row label="Address" right={
            <ChipChevron>
              <Chip tone="warning" icon="clock">Verifying</Chip>
            </ChipChevron>
          }/>
          <Row label="Photo" sub="Add a photo" right={<Chevron/>}/>
        </Card>

        <Overline>Access</Overline>
        <Card>
          <Row label="Keys & codes" sub="Not set" right={<Chevron/>}/>
          <Row label="Package delivery" sub="Not set" right={<Chevron/>}/>
          <Row label="Trusted neighbors" sub="Available after verification" right={<Chevron/>}/>
        </Card>

        <Overline>Members</Overline>
        <Card>
          <Row label="Household" sub="Just you" right={
            <ChipChevron>
              <Chip tone="primary">Invite</Chip>
            </ChipChevron>
          }/>
          <Row label="Roles & permissions" sub="Available after verification" right={<Chevron/>}/>
        </Card>

        <Overline>Notifications</Overline>
        <Card>
          <Row label="Notification preferences" sub="Default" right={<Chevron/>}/>
          <Row label="Quiet hours" sub="Not set" right={<Chevron/>}/>
          <Row label="Emergency contacts" sub="None added" right={<Chevron/>}/>
        </Card>

        <div style={{height:18}}/>
        <Card>
          <Row label="Cancel claim" destructive/>
        </Card>

        <MonoFooter>42 Magnolia Court · Claim ID 8174</MonoFooter>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameHomeSettingsPopulated, FrameHomeSettingsPending });
