// A21.2 — Local profile (public)
// Inherits the A21 Public Beacon profile archetype · local/visitor variant.
// Green Home identity · verified-neighbor shield · post feed · no Tiers tab.

function A21_2_Populated() {
  return (
    <Phone>
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <Banner identity="home" />
        <FloatingBack right="more-horizontal" />
        <IdentityBlock
          surface="local" role="visitor" identity="home"
          name="Devon Halley"
          handle="@devonh"
          verifiedNeighbor
          locality="Chestnut Hill"
          avatarGradient="linear-gradient(135deg,#34d399,#15803d)"
          bio="Apt 2A at 88 Beech. Carpenter by trade — extra clamps, a working drill, and a side-yard grill that's seen things. Knock if you need."
          stats={[
            { value: '214', label: 'Connections' },
            { value: '36',  label: 'Posts' },
            { value: '4.9', label: 'Rating' },
          ]}
        />
        <TabStrip tabs={[
          { label: 'Posts', count: 36, active: true },
          { label: 'About' },
        ]} />
        <div style={{ padding: '14px 16px 30px' }}>
          <LocalPostCard
            time="1h ago" locality="88 Beech St"
            body="Free pile on the curb — leftover 2×4s from the deck job, a pair of sawhorses, half a can of stain. Take what you need before the rain hits at 5."
            reactions="28" replies="12"
            intentChip="Offer" intentBg={B.homeBg} intentColor={B.home} intentIcon="hand"
          />
          <LocalPostCard
            time="Yesterday" locality="Chestnut Hill"
            body="Heads up — water main flagged on Beech between 88 and 96. City van says shut-off 9–noon Thursday. Fill a pitcher tomorrow night."
            reactions="47" replies="18"
            intentChip="Alert" intentBg={B.warningBg} intentColor={B.warning} intentIcon="triangle-alert"
          />
          <LocalPostCard
            time="3d ago" locality="Maple & 4th"
            body="Saturday small-fix clinic at the community shed — bring a chair, a broken lamp, or that wobbly drawer. I'll run the table saw. 10am till the coffee runs out."
            reactions="64" replies="29"
            intentChip="Event" intentBg={B.personalBg} intentColor={B.personal} intentIcon="calendar"
          />
        </div>
      </div>
    </Phone>
  );
}

function A21_2_Empty() {
  return (
    <Phone>
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <Banner identity="home" />
        <FloatingBack right="more-horizontal" />
        <IdentityBlock
          surface="local" role="visitor" identity="home"
          name="Priya Raman"
          handle="@priyar"
          verifiedNeighbor
          locality="Cedar Heights"
          avatarGradient="linear-gradient(135deg,#86efac,#15803d)"
          bio="Just moved into 14 Cedar Heights last week. Two cats, one houseplant collection that's threatening to take the kitchen. Saying hi."
          stats={[
            { value: '8',  label: 'Connections' },
            { value: '0',  label: 'Posts' },
            { value: 'New', label: 'Neighbor' },
          ]}
        />
        <TabStrip tabs={[
          { label: 'Posts', count: 0, active: true },
          { label: 'About' },
        ]} />
        <EmptyState
          icon="home"
          title="Quiet for now"
          body="No posts yet — Priya just moved in. Say hi or send a message to break the ice."
          ctaLabel="Send a message"
          ctaIcon="message-square"
          tint="home"
        />
      </div>
    </Phone>
  );
}

Object.assign(window, { A21_2_Populated, A21_2_Empty });
