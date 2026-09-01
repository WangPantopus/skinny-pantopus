// A14.3 — Settings (src/app/settings.tsx)
// Global, account-wide settings index. Same chevron-row archetype as A14.1
// but scoped to the user, not a specific home. Verification gets its own
// group (vs. a single row under Account in the archetype reference).
// Two frames: settled account (populated) · mid-onboarding (secondary state)

function FrameSettingsPopulated() {
  return (
    <Phone>
      <TopBar title="Settings"/>
      <div style={{flex:1, overflow:'auto', paddingBottom:24}}>
        <Overline>Account</Overline>
        <Card>
          <Row label="Edit profile" sub="Maria Lewin · she/her" right={<Chevron/>}/>
          <Row label="Email" sub="maria@pantopus.co" right={<Chevron/>}/>
          <Row label="Password" sub="Last changed Feb 2024" right={<Chevron/>}/>
          <Row label="Connected accounts" sub="Google, Apple" right={<Chevron/>}/>
        </Card>

        <Overline>Privacy</Overline>
        <Card>
          <Row label="Visibility preferences" sub="Verified connections only" right={<Chevron/>}/>
          <Row label="Blocked users" sub="3 people" right={<Chevron/>}/>
          <Row label="Data export" right={<Chevron/>}/>
        </Card>

        <Overline>Notifications</Overline>
        <Card>
          <Row label="Notification preferences" sub="Push, email, SMS" right={<Chevron/>}/>
        </Card>

        <Overline>Payments</Overline>
        <Card>
          <Row label="Payments & payouts" right={
            <ChipChevron><Chip tone="success">Stripe connected</Chip></ChipChevron>
          }/>
          <Row label="Payment methods" sub="Visa •• 4421, Apple Pay" right={<Chevron/>}/>
          <Row label="Tax info" sub="W-9 on file" right={<Chevron/>}/>
        </Card>

        <Overline>Verification</Overline>
        <Card helper="Each verified item builds trust without exposing more than you choose.">
          <Row label="Identity" right={
            <ChipChevron><Chip tone="success" icon="shield-check">Verified</Chip></ChipChevron>
          }/>
          <Row label="Address" sub="14 Elm Park Lane" right={
            <ChipChevron><Chip tone="success" icon="shield-check">Verified</Chip></ChipChevron>
          }/>
          <Row label="Phone" sub="(•••) 555-0182" right={
            <ChipChevron><Chip tone="success" icon="shield-check">Verified</Chip></ChipChevron>
          }/>
          <Row label="Email" right={
            <ChipChevron><Chip tone="success" icon="shield-check">Verified</Chip></ChipChevron>
          }/>
        </Card>

        <Overline>About</Overline>
        <Card>
          <Row label="Help" right={<Chevron/>}/>
          <Row label="Legal" right={<Chevron/>}/>
          <Row label="About Pantopus" sub="Version 4.2.1 (1834)" right={<Chevron/>}/>
        </Card>

        <div style={{height:18}}/>
        <Card>
          <Row label="Log out" destructive/>
        </Card>

        <MonoFooter>maria@pantopus · ID 8174</MonoFooter>
      </div>
    </Phone>
  );
}

// Secondary state: mid-onboarding account. Mixed chip vocabulary —
// some items verified, others verifying, payments not yet connected,
// profile still incomplete. Same archetype, same density, different state.
function FrameSettingsOnboarding() {
  return (
    <Phone>
      <TopBar title="Settings"/>
      <div style={{flex:1, overflow:'auto', paddingBottom:24}}>
        <Overline>Account</Overline>
        <Card>
          <Row label="Edit profile" sub="Add bio & photo" right={
            <ChipChevron><Chip tone="warning">Incomplete</Chip></ChipChevron>
          }/>
          <Row label="Email" sub="elena.park@gmail.com" right={<Chevron/>}/>
          <Row label="Password" sub="Set 3 days ago" right={<Chevron/>}/>
          <Row label="Connected accounts" sub="Google" right={<Chevron/>}/>
        </Card>

        <Overline>Privacy</Overline>
        <Card>
          <Row label="Visibility preferences" sub="Default — verified only" right={<Chevron/>}/>
          <Row label="Blocked users" sub="None" right={<Chevron/>}/>
          <Row label="Data export" right={<Chevron/>}/>
        </Card>

        <Overline>Notifications</Overline>
        <Card>
          <Row label="Notification preferences" sub="Default" right={<Chevron/>}/>
        </Card>

        <Overline>Payments</Overline>
        <Card helper="Connect Stripe to receive payouts and pay neighbors.">
          <Row label="Payments & payouts" right={
            <ChipChevron><Chip tone="primary">Connect</Chip></ChipChevron>
          }/>
          <Row label="Payment methods" sub="None added" right={<Chevron/>}/>
          <Row label="Tax info" sub="Required before payout" right={<Chevron/>}/>
        </Card>

        <Overline>Verification</Overline>
        <Card helper="2 of 4 verified. Address card arriving by May 31.">
          <Row label="Identity" sub="Driver's license" right={
            <ChipChevron><Chip tone="success" icon="shield-check">Verified</Chip></ChipChevron>
          }/>
          <Row label="Address" sub="Mail in transit" right={
            <ChipChevron><Chip tone="warning" icon="clock">Verifying</Chip></ChipChevron>
          }/>
          <Row label="Phone" right={
            <ChipChevron><Chip tone="success" icon="shield-check">Verified</Chip></ChipChevron>
          }/>
          <Row label="Email" sub="Confirmation sent" right={
            <ChipChevron><Chip tone="warning" icon="clock">Verifying</Chip></ChipChevron>
          }/>
        </Card>

        <Overline>About</Overline>
        <Card>
          <Row label="Help" right={<Chevron/>}/>
          <Row label="Legal" right={<Chevron/>}/>
          <Row label="About Pantopus" sub="Version 4.2.1 (1834)" right={<Chevron/>}/>
        </Card>

        <div style={{height:18}}/>
        <Card>
          <Row label="Log out" destructive/>
        </Card>

        <MonoFooter>elena.park@gmail.com · Joined 3 days ago</MonoFooter>
      </div>
    </Phone>
  );
}

Object.assign(window, { FrameSettingsPopulated, FrameSettingsOnboarding });
