// A21.1 — Persona profile (public)
// Inherits the A21 Public Beacon profile archetype · persona/visitor variant.
// Populated + empty (no broadcasts yet).

function A21_1_Populated() {
  return (
    <Phone>
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <Banner identity="personal" />
        <FloatingBack right="more-horizontal" />
        <IdentityBlock
          surface="persona" role="visitor" identity="personal"
          name="Sana Ortiz"
          handle="@sanaortiz"
          tier="Persona · Verified"
          avatarGradient="linear-gradient(135deg,#38bdf8,#0369a1)"
          bio="Urban sketcher — watercolors at lunch, ink at night. Broadcasting from cafés around Bay Ridge and the F train."
          stats={[
            { value: '3.4K', label: 'Beacons' },
            { value: '92',   label: 'Broadcasts' },
            { value: 'Mar 24', label: 'Member' },
          ]}
        />
        <CategoryChips chips={[
          { label: 'Illustration', bg: B.primary50, fg: B.primary700, icon: 'pen-tool' },
          { label: 'Watercolor',   bg: B.businessBg, fg: B.business, icon: 'palette' },
          { label: 'Sketchbook',   bg: B.warningBg, fg: B.warning,  icon: 'book-open' },
          { label: 'Brooklyn',     bg: B.homeBg,    fg: B.home,     icon: 'map-pin' },
        ]} />
        <TabStrip tabs={[
          { label: 'Broadcasts', count: 92, active: true },
          { label: 'About' },
          { label: 'Tiers', count: 2 },
        ]} />
        <div style={{ padding: '14px 16px 30px' }}>
          <BroadcastCard
            time="3h ago" visibility="Free"
            body="Spent the morning at the bodega on 4th — the owner said I could sit as long as I drank something every hour. Three watercolors and four coffees later, here's the one I liked."
            hasMedia
            mediaGradient="linear-gradient(135deg,#fed7aa 0%,#ea580c 60%,#7c2d12 100%)"
            reactions="248" replies="32"
          />
          <BroadcastCard
            time="Yesterday" visibility="Bronze+"
            body="Process video — the full 22-minute ink-and-wash for the bridge piece. Layer breakdown, brush choices, and the part where I almost gave up at minute 14."
            hasMedia
            mediaGradient="linear-gradient(135deg,#dbeafe 0%,#1d4ed8 70%, #1e3a8a 100%)"
            reactions="74" replies="11"
            locked lockTier="Bronze"
          />
          <BroadcastCard
            time="2d ago" visibility="Free"
            body="Reader question: 'cold-press or hot-press for ink-first?' Cold-press, always. Tooth grabs the line. Hot-press feels like skating on a desk."
            reactions="156" replies="44"
          />
        </div>
      </div>
    </Phone>
  );
}

function A21_1_Empty() {
  return (
    <Phone>
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <Banner identity="personal" />
        <FloatingBack right="more-horizontal" />
        <IdentityBlock
          surface="persona" role="visitor" identity="personal"
          name="Otis Park"
          handle="@otispark"
          tier="Persona · New"
          avatarGradient="linear-gradient(135deg,#38bdf8,#075985)"
          bio="Just set up the page. Probably going to broadcast about bonsai, slow cooking, and the slow internet at my favorite library."
          stats={[
            { value: '12', label: 'Beacons' },
            { value: '0',  label: 'Broadcasts' },
            { value: 'May 24', label: 'Member' },
          ]}
        />
        <CategoryChips chips={[
          { label: 'Bonsai',   bg: B.homeBg,    fg: B.home,    icon: 'sprout' },
          { label: 'Cooking',  bg: B.warningBg, fg: B.warning, icon: 'utensils' },
          { label: 'Libraries',bg: B.primary50, fg: B.primary700, icon: 'book' },
        ]} />
        <TabStrip tabs={[
          { label: 'Broadcasts', count: 0, active: true },
          { label: 'About' },
          { label: 'Tiers' },
        ]} />
        <EmptyState
          icon="radio-tower"
          title="No broadcasts yet"
          body="Be the first to follow — you'll get a ping the moment Otis goes live."
          ctaLabel="Follow"
          ctaIcon="plus"
          tint="personal"
        />
      </div>
    </Phone>
  );
}

Object.assign(window, { A21_1_Populated, A21_1_Empty });
