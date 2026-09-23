#!/usr/bin/env python3
"""Home Security option (c) on iOS + Android, and the Home settings/Security test updates."""

base = '/private/tmp/pantopus-stream2-work-native/'


def edit(path, old, new, count=1):
    p = base + path
    s = open(p).read()
    assert s.count(old) == count, (path, s.count(old), old[:90])
    s = s.replace(old, new)
    open(p, 'w').write(s)


def cut(path, start_marker, end_marker):
    p = base + path
    s = open(p).read()
    a = s.index(start_marker)
    b = s.index(end_marker, a)
    s = s[:a] + s[b:]
    open(p, 'w').write(s)


I = 'frontend/apps/ios/'
A = 'frontend/apps/android/app/src/'
HELPER_ON = "Place shows this Home's street without the unit number."
HELPER_OFF = "Place shows this Home's full street address, including the unit number."

# ── iOS view model ──────────────────────────────────────────────────────────────────
V = I + 'Pantopus/Features/Homes/Settings/Security/HomeSecurityViewModel.swift'
edit(V, '''//  P5.1 / A14.2 — Per-home Security toggles. Pure switchgear: 3
//  groups × 3 toggles = 9 toggles total. The helper line under each
//  card mirrors the design's "shifts based on current state" rule —
//  default mixed-state copy when at least the headline toggle of the
//  group is on, all-on consequence copy when every toggle in the
//  group is on, and an "off" warning when the headline toggle is
//  flipped off.
//
//  Two variant frames cover the design parity audit:
//    `.balanced`  — 5 of 9 toggles on, helpers read calm
//    `.strict`    — all 9 on, helpers shift to consequence language
''', '''//  P5.1 / A14.2 — Per-home Security. Nine toggles are stored per Home, but
//  only address precision changes anything (the server drops the unit
//  number from Place), so it is the only one offered, and its helper line
//  says what it does. The other eight are read by nothing on the server or
//  any client; they're hidden and their stored values are left as they are.
//
//  Two seed frames (previews, tests and the offline baseline):
//    `.balanced`  — 5 of 9 toggles on
//    `.strict`    — all 9 on
''')
edit(V, '''    public var footerCaption: String? {
        "\\(footerHomeName) · Last audit 2h ago"
    }''', '''    /// No footer: it used to show a sample address ("14 Elm Park Lane") and a
    /// made-up "Last audit 2h ago" for every Home.
    public var footerCaption: String? {
        nil
    }''')
edit(V, '''    private let footerHomeName: String
''', '')
edit(V, '''    public convenience init(
        homeId: String,
        variant: Variant = .balanced,
        homeName: String = "14 Elm Park Lane"
    ) {
        self.init(
            homeId: homeId,
            api: .shared,
            variant: variant,
            homeName: homeName
        )
    }

    init(
        homeId: String,
        api: APIClient,
        variant: Variant = .balanced,
        homeName: String = "14 Elm Park Lane"
    ) {
        self.homeId = homeId
        self.api = api
        footerHomeName = homeName
        toggles = Self.seedToggles(for: variant)
    }''', '''    public convenience init(
        homeId: String,
        variant: Variant = .balanced
    ) {
        self.init(
            homeId: homeId,
            api: .shared,
            variant: variant
        )
    }

    init(
        homeId: String,
        api: APIClient,
        variant: Variant = .balanced
    ) {
        self.homeId = homeId
        self.api = api
        toggles = Self.seedToggles(for: variant)
    }''')
edit(V, '''    private func groups() -> [GroupedListGroup] {
        [
            accessControlGroup(),
            privacyGroup(),
            documentsGroup()
        ]
    }''', '''    /// Only the control something enforces is offered: address precision.
    private func groups() -> [GroupedListGroup] {
        [accessControlGroup()]
    }''')
edit(V, '''            rows: [
                toggleRow(id: Toggles.guestApproval, label: "Guest approval", sub: "Ask before letting in new passes"),
                toggleRow(id: Toggles.memberNameVisibility, label: "Member name visibility", sub: "Show only your home name to outsiders"),
                toggleRow(id: Toggles.addressPrecision, label: "Address precision", sub: "Street only · hide unit number")
            ]''', '''            rows: [
                toggleRow(id: Toggles.addressPrecision, label: "Address precision", sub: "Street only · hide unit number")
            ]''')
cut(V, '    private func privacyGroup() -> GroupedListGroup {', '    private func toggleRow(')
edit(V, '''    static func helperForAccessControl(toggles: [String: Bool]) -> String {
        let approval = toggles[Toggles.guestApproval] ?? false
        let allOn = (toggles[Toggles.guestApproval] ?? false)
            && (toggles[Toggles.memberNameVisibility] ?? false)
            && (toggles[Toggles.addressPrecision] ?? false)
        if allOn {
            return "All guest activity requires your explicit approval. Names and street precision are hidden from outsiders."
        } else if approval {
            return "Guest approval is on, so guests need an owner-tap to enter."
        } else {
            return "Guest approval is off — anyone with a code is in. Tighten this if you're away."
        }
    }
''', f'''    static func helperForAccessControl(toggles: [String: Bool]) -> String {{
        (toggles[Toggles.addressPrecision] ?? false)
            ? "{HELPER_ON}"
            : "{HELPER_OFF}"
    }}
''')
cut(V, '    static func helperForPrivacy(toggles: [String: Bool]) -> String {', '    // MARK: - Seed data')

# ── Android view model + screen ─────────────────────────────────────────────────────
K = A + 'main/java/app/pantopus/android/ui/screens/homes/settings/security/HomeSecurityViewModel.kt'
edit(K, '''/**
 * P5.1 / A14.2 — Per-home Security toggles. Pure switchgear: 3
 * groups × 3 toggles = 9 toggles total. Helper-line copy under each
 * card mirrors the design's state-aware rule — calm default copy
 * when only the headline toggle is on, all-on consequence copy when
 * every toggle in the group is on, and an "off" warning when the
 * headline toggle is flipped off.
 *''', '''/**
 * P5.1 / A14.2 — Per-home Security. Nine toggles are stored per Home, but
 * only address precision changes anything (the server drops the unit
 * number from Place), so it is the only one offered, and its helper line
 * says what it does. The other eight are read by nothing on the server or
 * any client; they're hidden and their stored values are left as they are.
 *''')
edit(K, ''' * Two variant frames cover the design parity audit:
 *   - [Variant.Balanced] 5 of 9 toggles on
 *   - [Variant.Strict]   all 9 on, helpers shift to consequence
 *                        language
 */''', ''' * Two seed frames (previews, tests and the offline baseline):
 *   - [Variant.Balanced] 5 of 9 toggles on
 *   - [Variant.Strict]   all 9 on
 */''')
edit(K, '''        val footerCaption: String = "$footerHomeName · Last audit 2h ago"
''', '''        // No footer: it used to show a sample address ("14 Elm Park Lane") and a made-up "Last audit 2h ago" for
        // every Home.
        val footerCaption: String? = null
''')
edit(K, '''        private val footerHomeName: String get() = "14 Elm Park Lane"

''', '')
edit(K, '''        private fun groups(): List<GroupedListGroup> =
            listOf(
                accessControlGroup(),
                privacyGroup(),
                documentsGroup(),
            )''', '''        // Only the control something enforces is offered: address precision.
        private fun groups(): List<GroupedListGroup> = listOf(accessControlGroup())''')
edit(K, '''                rows =
                    listOf(
                        toggleRow(HomeSecurityToggles.GUEST_APPROVAL, "Guest approval", "Ask before letting in new passes"),
                        toggleRow(
                            HomeSecurityToggles.MEMBER_NAME_VISIBILITY,
                            "Member name visibility",
                            "Show only your home name to outsiders",
                        ),
                        toggleRow(
                            HomeSecurityToggles.ADDRESS_PRECISION,
                            "Address precision",
                            "Street only · hide unit number",
                        ),
                    ),''', '''                rows =
                    listOf(
                        toggleRow(
                            HomeSecurityToggles.ADDRESS_PRECISION,
                            "Address precision",
                            "Street only · hide unit number",
                        ),
                    ),''')
cut(K, '        private fun privacyGroup(): GroupedListGroup =', '        private fun toggleRow(')
edit(K, '''    fun forAccessControl(toggles: Map<String, Boolean>): String {
        val approval = toggles[HomeSecurityToggles.GUEST_APPROVAL] ?: false
        val allOn =
            (toggles[HomeSecurityToggles.GUEST_APPROVAL] ?: false) &&
                (toggles[HomeSecurityToggles.MEMBER_NAME_VISIBILITY] ?: false) &&
                (toggles[HomeSecurityToggles.ADDRESS_PRECISION] ?: false)
        return when {
            allOn -> "All guest activity requires your explicit approval. Names and street precision are hidden from outsiders."
            approval -> "Guest approval is on, so guests need an owner-tap to enter."
            else -> "Guest approval is off — anyone with a code is in. Tighten this if you're away."
        }
    }
''', f'''    fun forAccessControl(toggles: Map<String, Boolean>): String =
        if (toggles[HomeSecurityToggles.ADDRESS_PRECISION] == true) {{
            "{HELPER_ON}"
        }} else {{
            "{HELPER_OFF}"
        }}
''')
p = base + K
s = open(p).read()
a = s.index('\n    fun forPrivacy(toggles: Map<String, Boolean>): String {')
b = s.rindex('\n}')
s = s[:a] + s[b:]
open(p, 'w').write(s)

# ── Tests ────────────────────────────────────────────────────────────────────────────
T = I + 'PantopusTests/Features/Homes/HomeSecurityViewModelTests.swift'
edit(T, '''//  P5.1 / A14.2 — projection tests for the per-home Security toggles.
//  Locks the audit's required shape (3 groups × 3 toggles = 9) plus
//  the helper-line copy contract — the strings here MUST stay in
//  sync with the Android `HomeSecurityHelpers` object so that
//  iOS+Android parity holds.''', '''//  P5.1 / A14.2 — projection tests for the per-home Security screen.
//  Locks the shape (only the enforced address-precision toggle is offered;
//  all nine stored toggles stay in the model) plus the helper-line copy —
//  the strings here MUST stay in sync with the Android
//  `HomeSecurityHelpers` object so that iOS+Android parity holds.''')
edit(T, '''        XCTAssertEqual(groups.map(\\.id), ["accessControl", "privacy", "documents"])
        for group in groups {
            XCTAssertEqual(group.rows.count, 3, "Group \\(group.id) should have 3 toggles")
            for row in group.rows {
                if case .toggle = row.control { /* ok */ } else {
                    XCTFail("Row \\(row.id) should be a toggle")
                }
            }
        }''', '''        XCTAssertEqual(groups.map(\\.id), ["accessControl"])
        XCTAssertEqual(groups.first?.rows.map(\\.id), [HomeSecurityViewModel.Toggles.addressPrecision])
        for row in groups.flatMap(\\.rows) {
            if case .toggle = row.control { /* ok */ } else {
                XCTFail("Row \\(row.id) should be a toggle")
            }
        }''')
edit(T, '''        XCTAssertEqual(
            helpers["accessControl"],
            "Guest approval is on, so guests need an owner-tap to enter."
        )
        XCTAssertEqual(
            helpers["privacy"],
            "Visible to verified neighbors only. Address used for deliveries."
        )
        XCTAssertEqual(
            helpers["documents"],
            "Docs unlock with Face ID. Previews still appear in chat."
        )''', f'''        XCTAssertEqual(
            helpers["accessControl"],
            "{HELPER_OFF}"
        )''')
edit(T, '''        XCTAssertEqual(
            helpers["accessControl"],
            "All guest activity requires your explicit approval. Names and street precision are hidden from outsiders."
        )
        XCTAssertEqual(
            helpers["privacy"],
            "Hidden from the neighborhood map, previews suppressed. Outsiders only see your home name."
        )
        XCTAssertEqual(
            helpers["documents"],
            "All docs require Face ID. Previews stay blurred everywhere, including notifications."
        )''', f'''        XCTAssertEqual(
            helpers["accessControl"],
            "{HELPER_ON}"
        )''')
cut(T, '    func testGuestApprovalOffShowsTighten() async {', '    func testToggleFlipUpdatesState() async {')

KT = A + 'test/java/app/pantopus/android/ui/screens/homes/settings/security/HomeSecurityViewModelTest.kt'
edit(KT, ''' * P5.1 / A14.2 — projection tests for the per-home Security toggles.
 * Locks the audit's required shape (3 groups × 3 toggles = 9) plus the
 * helper-line copy contract — the strings here MUST stay in sync with the
 * iOS `HomeSecurityViewModel` helpers so iOS+Android parity holds.''', ''' * P5.1 / A14.2 — projection tests for the per-home Security screen.
 * Locks the shape (only the enforced address-precision toggle is offered;
 * all nine stored toggles stay in the model) plus the helper-line copy —
 * the strings here MUST stay in sync with the iOS `HomeSecurityViewModel`
 * helpers so iOS+Android parity holds.''')
edit(KT, '''            assertEquals(listOf("accessControl", "privacy", "documents"), groups.map { it.id })
            for (group in groups) {
                assertEquals(3, group.rows.size)
                for (row in group.rows) {
                    assertTrue("Row ${row.id} should be a toggle", row.control is RowControl.Toggle)
                }
            }''', '''            assertEquals(listOf("accessControl"), groups.map { it.id })
            assertEquals(listOf(HomeSecurityToggles.ADDRESS_PRECISION), groups.first().rows.map { it.id })
            for (row in groups.flatMap { it.rows }) {
                assertTrue("Row ${row.id} should be a toggle", row.control is RowControl.Toggle)
            }''')
edit(KT, '''        assertEquals(
            "Guest approval is on, so guests need an owner-tap to enter.",
            helpers["accessControl"],
        )
        assertEquals(
            "Visible to verified neighbors only. Address used for deliveries.",
            helpers["privacy"],
        )
        assertEquals(
            "Docs unlock with Face ID. Previews still appear in chat.",
            helpers["documents"],
        )''', f'''        assertEquals(
            "{HELPER_OFF}",
            helpers["accessControl"],
        )''')
edit(KT, '''        assertEquals(
            "All guest activity requires your explicit approval. Names and street precision are hidden from outsiders.",
            helpers["accessControl"],
        )
        assertEquals(
            "Hidden from the neighborhood map, previews suppressed. Outsiders only see your home name.",
            helpers["privacy"],
        )
        assertEquals(
            "All docs require Face ID. Previews stay blurred everywhere, including notifications.",
            helpers["documents"],
        )''', f'''        assertEquals(
            "{HELPER_ON}",
            helpers["accessControl"],
        )''')
cut(KT, '    @Test\n    fun guest_approval_off_shows_tighten() =', '    @Test\n    fun toggle_flip_updates_state() =')

ST = I + 'PantopusTests/Features/Homes/HomeSettingsViewModelTests.swift'
edit(ST, '''            ["accessCodes", "trustedNeighbors", "privacy", "ownershipSecurity"]''', '''            ["accessCodes", "privacy", "ownershipSecurity"]''')
edit(ST, '''        XCTAssertEqual(propertyDetails?.subtext, "Not set")
        let trustedNeighbors = row(vm: vm, groupId: "access", rowId: "trustedNeighbors")
        XCTAssertEqual(trustedNeighbors?.subtext, "Available after verification")''', '''        XCTAssertEqual(propertyDetails?.subtext, "Not set")''')
SK = A + 'test/java/app/pantopus/android/ui/screens/homes/settings/HomeSettingsViewModelTest.kt'
edit(SK, '''            listOf("accessCodes", "trustedNeighbors", "privacy", "ownershipSecurity"),''', '''            listOf("accessCodes", "privacy", "ownershipSecurity"),''')
print('home security + tests: ok')
