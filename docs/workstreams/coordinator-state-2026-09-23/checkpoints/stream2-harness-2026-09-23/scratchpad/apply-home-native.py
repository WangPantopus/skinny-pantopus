#!/usr/bin/env python3
"""Home trust-claims native edits (iOS + Android), applied to the native worktree on claude/stream2-home-trust-claims."""
import re

base = '/private/tmp/pantopus-stream2-work-native/'


def edit(path, old, new, count=1):
    p = base + path
    s = open(p).read()
    assert s.count(old) == count, (path, s.count(old), old[:90])
    s = s.replace(old, new)
    open(p, 'w').write(s)


def cut(path, start_marker, end_marker, keep_end=True):
    """Remove the text from start_marker up to end_marker (end kept)."""
    p = base + path
    s = open(p).read()
    a = s.index(start_marker)
    b = s.index(end_marker, a)
    s = s[:a] + (s[b:] if keep_end else s[b + len(end_marker):])
    open(p, 'w').write(s)


I = 'frontend/apps/ios/Pantopus/'
A = 'frontend/apps/android/app/src/main/java/app/pantopus/android/'

# ── 1. Hub pill: count_neighbors_within counts every active occupancy (verified or not, the viewer's own included) ──
edit(I + 'Features/Hub/HubState.swift',
     '''    /// Pill copy — "👥 12 verified neighbors within 1 mi" in RN; the
    /// native pill renders the glyph separately.
    public var pillText: String {
        let noun = count == 1 ? "neighbor" : "neighbors"
        return "\\(count) verified \\(noun) within \\(Self.formatRadius(radiusMiles))"
    }''',
     '''    /// Pill copy — "12 neighbors within 1 mi"; the native pill renders
    /// the glyph separately. The count (`count_neighbors_within`) is every
    /// active occupancy in range, verified or not, so it doesn't say
    /// "verified".
    public var pillText: String {
        let noun = count == 1 ? "neighbor" : "neighbors"
        return "\\(count) \\(noun) within \\(Self.formatRadius(radiusMiles))"
    }''')
edit(A + 'ui/screens/hub/HubUiState.kt',
     '''    /** "12 verified neighbors within 1 mi". */
    val pillText: String
        get() {
            val noun = if (count == 1) "neighbor" else "neighbors"
            return "$count verified $noun within ${formatRadius(radiusMiles)}"
        }''',
     '''    /**
     * "12 neighbors within 1 mi". The count (`count_neighbors_within`) is
     * every active occupancy in range, verified or not, so it doesn't say
     * "verified".
     */
    val pillText: String
        get() {
            val noun = if (count == 1) "neighbor" else "neighbors"
            return "$count $noun within ${formatRadius(radiusMiles)}"
        }''')

# ── 2. Community feed card: no "N reached" (neighbors_received is not a real count) ──
edit(I + 'Features/Mailbox/Community/Components/CommunityFeedCard.swift',
     '''            stat(icon: .eye, text: "\\(item.views)")
            stat(icon: .users, text: "\\(item.neighborsReceived) reached")
''',
     '''            stat(icon: .eye, text: "\\(item.views)")
''')
edit(A + 'ui/screens/mailbox/community/components/CommunityFeedCard.kt',
     '''        Stat(icon = PantopusIcon.Eye, text = "${item.views}")
        Stat(icon = PantopusIcon.Users, text = "${item.neighborsReceived} reached")
''',
     '''        Stat(icon = PantopusIcon.Eye, text = "${item.views}")
''')

# ── 3. Home settings: no Trusted neighbors entry (no backend feature behind it) ──
edit(I + 'Features/Homes/Settings/HomeSettingsViewModel.swift',
     '''            GroupedListRow(id: "trustedNeighbors", label: "Trusted neighbors", subtext: subtexts.trustedNeighbors, control: .chevron),
''', '')
edit(A + 'ui/screens/homes/settings/HomeSettingsViewModel.kt',
     '''                        GroupedListRow(
                            "trustedNeighbors",
                            "Trusted neighbors",
                            subtext = subtexts.trustedNeighbors,
                            control = RowControl.Chevron,
                        ),
''', '')

print('hub pill, community stat, trusted neighbors: ok')

# Preview/snapshot sample frames mirror the live layout.
edit(A + 'ui/screens/homes/settings/HomeSettingsSampleData.kt',
     '''                                GroupedListRow(
                                    "trustedNeighbors",
                                    "Trusted neighbors",
                                    subtext = "3 approved",
                                    control = RowControl.Chevron,
                                ),
''', '')
edit(A + 'ui/screens/homes/settings/HomeSettingsSampleData.kt',
     '''                                GroupedListRow(
                                    "trustedNeighbors",
                                    "Trusted neighbors",
                                    subtext = "Available after verification",
                                    control = RowControl.Chevron,
                                ),
''', '')
print('android sample frames: ok')
