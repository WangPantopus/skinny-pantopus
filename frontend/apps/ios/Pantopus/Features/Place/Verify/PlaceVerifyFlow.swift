//
//  PlaceVerifyFlow.swift
//  Pantopus
//
//  B1–B4 — the address-verification flow. B1 is a bottom sheet (the
//  "what this unlocks" benefits + a method picker); choosing a method
//  pushes the status screen, which shows B2 (pending, per method), then
//  B3 (verified success, staged reveal) or B4 (couldn't verify, with
//  the other methods). Ported from place-verify*.jsx. Verification is
//  multi-day async server-side, so the status screen models the states.
//

import SwiftUI

// MARK: - Method model

public enum PlaceVerifyMethod: String, CaseIterable, Hashable, Sendable {
    // Two doors with equal billing (Wedge Phase 2, D3): the instant one
    // first, the postcard as the keepsake, the landlord as the third path.
    case document
    case mail
    case landlord
    /// FASTVERIFY: the phone number check, drawn only while the server offers it.
    case phone
    /// FASTVERIFY: "I'm at home now", the location check (iPhone and Android only).
    case location

    /// Today's doors, in today's order (the faster sheet draws the server's).
    static let todayDoors: [PlaceVerifyMethod] = [.document, .mail, .landlord]

    var icon: PantopusIcon {
        switch self {
        case .document: .upload
        case .mail: .send
        case .landlord: .shieldCheck
        case .phone: .smartphone
        case .location: .mapPin
        }
    }

    var label: String {
        switch self {
        case .document: "Upload a document"
        case .mail: "Mail a code to my address"
        case .landlord: "Confirm with your landlord"
        case .phone: "Use my phone number"
        case .location: "I'm at home now"
        }
    }

    @MainActor var sub: String {
        switch self {
        case .document: "A utility bill, lease, or ID. A person reviews it."
        case .mail: "A postcard with a code, 3–7 days. Yours to keep."
        case .landlord: "Your landlord confirms that you live here."
        case .phone: "We text a code, then match the number to this address."
        case .location: "One tap. We check your \(DeviceWords.plainName)'s location once."
        }
    }
}

struct PlaceVerifyBenefit: Identifiable {
    let icon: PantopusIcon
    let label: String
    let sub: String
    var id: String {
        label
    }
}

/// The T4 unlocks that actually exist (Wedge v2 D4): proof you live here,
/// your rank on the block, and the rooms only verified neighbors see. The
/// digital mailbox joins the rank while Mailbox is on (launch cut #10).
var placeVerifyBenefits: [PlaceVerifyBenefit] {
    [
        .init(
            icon: .badgeCheck,
            label: "Proof you live here",
            sub: "Your verified badge, a residency letter, and a shareable Residency Pass"
        ),
        LaunchFeatures.mailbox
            ? .init(
                icon: .mailbox,
                label: "Your mailbox and your rank",
                sub: "The digital mailbox opens, and you take a permanent Block Founder number"
            )
            : .init(
                icon: .hash,
                label: "Your rank on the block",
                sub: "You take a permanent Block Founder number"
            ),
        .init(
            icon: .messageCircle,
            label: "What only verified residents see",
            sub: "Real rents on your block, messages between homes, the Fridge Card, rate watch"
        )
    ]
}

// MARK: - B1 — the verify sheet

struct PlaceVerifySheet: View {
    let address: String
    /// The Home being verified; it decides whether the landlord door is offered.
    var homeId: String?
    var onStart: (PlaceVerifyMethod) -> Void
    var onClose: () -> Void
    /// Opens the status of a residency document already in review (the Waiting Room).
    var onOpenDocumentStatus: (() -> Void)?

    init(
        address: String,
        homeId: String? = nil,
        onStart: @escaping (PlaceVerifyMethod) -> Void,
        onClose: @escaping () -> Void,
        onOpenDocumentStatus: (() -> Void)? = nil
    ) {
        self.address = address
        self.homeId = homeId
        self.onStart = onStart
        self.onClose = onClose
        self.onOpenDocumentStatus = onOpenDocumentStatus
        // Place reads the answer when it loads, so the sheet opens with the right rows.
        _fastOptions = State(initialValue: homeId.flatMap { HomeVerifyOptionsStore.shared.cached(homeId: $0) })
    }

    /// The server's ways to verify (FASTVERIFY). Nil while the switch is off: today's sheet.
    @State private var fastOptions: HomeVerifyOptions?

    /// Mail leads: a postcard finishes on its own, while documents wait for a person to review them.
    @State private var selected: PlaceVerifyMethod = .mail
    /// A landlord request can only be answered by a verified landlord, so that
    /// door joins once the Home has one (or the person already has a request).
    @State private var doors: [PlaceVerifyMethod] = [.mail, .document]
    /// A residency document the person sent waits on a reviewer: the document
    /// door says so instead of offering another upload.
    @State private var documentInReview = false

    var body: some View {
        Group {
            if let fastOptions {
                fastSheet(fastOptions, documentInReview: documentInReview)
                    .task(id: homeId) { await loadDocumentReview() }
            } else {
                todaySheet
            }
        }
        .task(id: homeId) { await loadFastOptions() }
    }

    private func loadFastOptions() async {
        guard let homeId else { return }
        fastOptions = await HomeVerifyOptionsStore.shared.load(homeId: homeId)
    }

    /// Today's sheet: what verifying unlocks, the doors, and one start button.
    private var todaySheet: some View {
        VStack(spacing: 0) {
            Capsule().fill(Theme.Color.appBorderStrong).frame(width: 40, height: 5).padding(.top, 8).padding(.bottom, 12)
            header(title: "Verify your address")
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    benefits
                    methods
                    calmNote
                }
                .padding(.bottom, 16)
            }
            PrimaryButton(title: "Start verification") { onStart(selected) }
                .padding(.top, 4)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 30)
        .background(Theme.Color.appSurface)
        .task(id: homeId) { await loadLandlordDoor() }
        .task(id: homeId) { await loadDocumentReview() }
    }

    private func loadLandlordDoor() async {
        guard let homeId else { return }
        // An unreadable status keeps the two doors that work without a landlord.
        guard let status: TenantHomeStatusResponse = try? await APIClient.shared.request(
            TenantEndpoints.homeStatus(homeId: homeId)
        ), status.matches(homeId: homeId), status.offersLandlordConfirmation else { return }
        doors = [.mail, .document, .landlord]
    }

    /// The person's own claims, as the Waiting Room reads them: a residency
    /// document for this Home that is under review (a claim with no document
    /// yet isn't). An unreadable list keeps the upload door.
    private func loadDocumentReview() async {
        guard let homeId else { return }
        guard let response: MyOwnershipClaimsResponse = try? await APIClient.shared.request(
            HomesEndpoints.myOwnershipClaims()
        ) else { return }
        let inReview = response.claims.contains { claim in
            claim.homeId.caseInsensitiveCompare(homeId) == .orderedSame && claim.claimType == "resident"
                && claim.status == "under_review" && claim.hasEvidence != false
        }
        guard inReview else { return }
        documentInReview = true
        if selected == .document { selected = .mail }
    }

    /// Shared with the faster sheet (`PlaceVerifyFastSheet.swift`).
    func header(title: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 11, style: .continuous).fill(Theme.Color.homeBg)
                RoundedRectangle(cornerRadius: 11, style: .continuous).strokeBorder(Theme.Color.successLight, lineWidth: 1)
                Icon(.shieldCheck, size: 20, strokeWidth: 2, color: Theme.Color.home)
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 18, weight: .bold))
                    .kerning(-0.36)
                    .foregroundStyle(Theme.Color.appText)
                Text(address)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            Button(action: onClose) {
                Icon(.x, size: 16, strokeWidth: 2.5, color: Theme.Color.appTextSecondary)
                    .frame(width: 30, height: 30).background(Theme.Color.appSurfaceSunken).clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
        }
        .padding(.bottom, 18)
    }

    private var benefits: some View {
        VStack(alignment: .leading, spacing: 9) {
            overline("What this unlocks")
            VStack(spacing: 0) {
                ForEach(Array(placeVerifyBenefits.enumerated()), id: \.offset) { index, b in
                    row(icon: b.icon, label: b.label, sub: b.sub, tone: .home, trailing: nil)
                    if index < placeVerifyBenefits.count - 1 { divider }
                }
            }
            .placeCard()
        }
    }

    private var methods: some View {
        VStack(alignment: .leading, spacing: 9) {
            overline("Choose how")
            VStack(spacing: 0) {
                ForEach(Array(doors.enumerated()), id: \.offset) { index, m in
                    if m == .document, documentInReview {
                        documentReviewRow
                    } else {
                        Button { selected = m } label: {
                            row(
                                icon: m.icon,
                                label: m.label,
                                sub: m.sub,
                                tone: .sky,
                                trailing: AnyView(radio(selected: selected == m))
                            )
                        }
                        .buttonStyle(.plain)
                        // A radio choice, so VoiceOver says which method is selected.
                        .accessibilityAddTraits(selected == m ? .isSelected : [])
                    }
                    if index < doors.count - 1 { divider }
                }
            }
            .placeCard()
        }
    }

    /// The document door while the person's residency document waits on a
    /// reviewer: where it stands and the way to its status, not a second upload.
    var documentReviewRow: some View {
        Button { onOpenDocumentStatus?() } label: {
            row(
                icon: .hourglass,
                label: "Document under review",
                sub: "A person is reviewing your document. You'll get a notification when it's decided.",
                tone: .muted,
                trailing: onOpenDocumentStatus == nil ? nil : AnyView(PlaceChevron())
            )
        }
        .buttonStyle(.plain)
        .disabled(onOpenDocumentStatus == nil)
        .accessibilityHint(onOpenDocumentStatus == nil ? "" : "Opens its status")
        .accessibilityIdentifier("place.verifySheet.documentInReview")
    }

    private var calmNote: some View {
        HStack(alignment: .top, spacing: 9) {
            Icon(.clock, size: 15, strokeWidth: 2, color: Theme.Color.appTextMuted).padding(.top, 1)
            Text("A postcard takes 3–7 days; documents are reviewed by a person. "
                + "Everything you have now stays available while you wait.")
                .font(.system(size: 12.5))
                .lineSpacing(2)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, 2)
    }

    func row(icon: PantopusIcon, label: String, sub: String, tone: PlaceIconTile.Tone, trailing: AnyView?) -> some View {
        HStack(spacing: 12) {
            PlaceIconTile(icon: icon, tone: tone, size: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.system(size: 14.5, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                Text(sub).font(.system(size: 12.5)).foregroundStyle(Theme.Color.appTextMuted)
            }
            Spacer(minLength: 0)
            if let trailing { trailing }
        }
        .padding(14)
    }

    private func radio(selected: Bool) -> some View {
        ZStack {
            Circle().strokeBorder(selected ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: 2).frame(width: 22, height: 22)
            if selected { Circle().fill(Theme.Color.primary600).frame(width: 12, height: 12) }
        }
    }

    var divider: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1).padding(.leading, 60)
    }

    func overline(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .bold))
            .kerning(0.6)
            .foregroundStyle(Theme.Color.appTextMuted)
            .padding(.horizontal, 2)
    }
}
