//
//  PlanBusinessComposerParts.swift
//  Pantopus
//
//  Plans with businesses, boards B1 to B3: the parts the composer adds for
//  a business. "Host as" (B1) sits above today's kinds; the details (B2)
//  add what guests see it called, one of the business's own locations and
//  who gets in, with no price and no repeats; the preview shows what guests
//  see; posted (B3) leads with bringing the business's own regulars. Words,
//  test ids and labels match Android's (the set the founder approved).
//

import MapKit
import SwiftUI

// MARK: - B1: host as

struct PlanHostAsSection: View {
    @Bindable var model: PlanComposerModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("Host as")
            PlanFormCard {
                option(
                    title: "You, \(model.hostName)",
                    subtitle: "A plan with neighbors. Always free.",
                    selected: model.hostAs == nil,
                    action: { model.hostAs = nil },
                    leading: { PlanAvatar(name: model.hostName, size: 40) }
                )
                .accessibilityIdentifier("planHostAsYou")
                ForEach(model.hostAsOptions) { business in
                    Divider().overlay(Theme.Color.appBorder)
                    option(
                        title: business.name,
                        subtitle: "A plan at your business.",
                        selected: model.hostAs?.id == business.id,
                        action: { model.hostAs = business },
                        leading: { PlanBusinessShape(url: business.avatarUrl, size: 40) }
                    )
                    .accessibilityIdentifier("planHostAsBusiness.\(business.userId)")
                }
            }
            PlanScopeLine(text: "Only the team of a verified business sees this choice.")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planHostAs")
    }

    private func option(
        title: String,
        subtitle: String,
        selected: Bool,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> some View
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                leading()
                VStack(alignment: .leading, spacing: 0) {
                    Text(title).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                    Text(subtitle).planFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if selected { Icon(.check, size: 22, strokeWidth: 2.6, color: Theme.Color.primary600) }
            }
            .padding(.vertical, 10)
            .frame(minHeight: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - B2: the details a business adds

/// "What guests see it called": the server's short list for the kind, never free text.
struct PlanBusinessLabelField: View {
    @Bindable var model: PlanComposerModel

    var body: some View {
        PlanFormField(label: "What guests see it called") {
            PlanChoiceChips(
                options: (model.businessKind?.labels ?? []).map { PlanChoiceOption(id: $0.key, label: $0.text) },
                isSelected: { $0 == model.businessLabel },
                onTap: { model.businessLabel = $0 },
                groupLabel: "What guests see it called",
                identifier: "planBusinessLabels"
            )
        }
    }
}

/// "Where": one of the business's own locations; more than one opens "Where?".
struct PlanBusinessWhereField: View {
    @Bindable var model: PlanComposerModel
    @State private var choosing = false

    var body: some View {
        PlanFormField(label: "Where") {
            let locations = model.hostAs?.locations ?? []
            Button { if locations.count > 1 { choosing = true } } label: {
                PlanBusinessLocationRow(
                    name: model.businessLocation.map { PlanBusinessLocationRow.name($0, business: model.hostAs) },
                    address: model.businessLocation?.address,
                    avatarUrl: model.hostAs?.avatarUrl,
                    choosable: locations.count > 1
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("planBusinessLocation")
            .confirmationDialog("Where?", isPresented: $choosing, titleVisibility: .visible) {
                ForEach(locations) { location in
                    Button(PlanBusinessLocationRow.line(location, business: model.hostAs)) { model.businessLocationId = location.id }
                        .accessibilityIdentifier("planBusinessLocation.\(location.id)")
                }
            }
            PlanScopeLine(
                text: "A business's plan shows its place to everyone. You choose from your business's own locations.",
                icon: .mapPin
            )
        }
    }
}

/// A business's location in a form card: its shape, name and street address.
struct PlanBusinessLocationRow: View {
    let name: String?
    let address: String?
    var avatarUrl: String?
    var choosable = false

    var body: some View {
        PlanFormCard {
            HStack(spacing: Spacing.s3) {
                PlanBusinessShape(url: avatarUrl, size: 36)
                VStack(alignment: .leading, spacing: 0) {
                    Text(name ?? "Choose a location").planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                    if let address {
                        Text(address).planFont(.small).foregroundStyle(Theme.Color.appTextSecondary).lineLimit(2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if choosable { Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted) }
            }
            .padding(.vertical, 10)
        }
        .accessibilityElement(children: .combine)
    }

    /// The location's own name, or the business's.
    static func name(_ location: PlanBusinessLocationDTO, business: PlanHostAsBusinessDTO?) -> String {
        location.label.flatMap { $0.isEmpty ? nil : $0 } ?? business?.name ?? "Your business"
    }

    /// "Main storefront · 410 NE 4th Ave, Camas".
    static func line(_ location: PlanBusinessLocationDTO, business: PlanHostAsBusinessDTO?) -> String {
        [name(location, business: business), location.address].compactMap { $0 }.joined(separator: " · ")
    }
}

/// "Who gets in": right away, or the business approves each person.
struct PlanWhoGetsInField: View {
    @Bindable var model: PlanComposerModel

    var body: some View {
        PlanFormField(label: "Who gets in") {
            PlanSegmented(
                options: [(true, "Right away"), (false, "I approve each")],
                selection: $model.letsEveryoneIn,
                label: "Who gets in",
                identifiers: ["planWhoGetsIn.open", "planWhoGetsIn.approve"]
            )
            .accessibilityIdentifier("planWhoGetsIn")
        }
    }
}

// MARK: - H7 for a business: what guests see

struct PlanBusinessPreviewCard: View {
    let model: PlanComposerModel

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let point = model.placePoint {
                let center = CLLocationCoordinate2D(latitude: point.latitude, longitude: point.longitude)
                Map(
                    initialPosition: .region(MKCoordinateRegion(center: center, latitudinalMeters: 900, longitudinalMeters: 900)),
                    interactionModes: []
                ) {
                    // A business's place is public: the pin, not an area.
                    Annotation("", coordinate: center, anchor: .center) {
                        PlanPinView(look: PlanPinLook(kind: model.kind, isBusiness: true))
                    }
                    .annotationTitles(.hidden)
                }
                .mapStyle(.standard(pointsOfInterest: .excludingAll))
                .frame(height: 120)
                .allowsHitTesting(false)
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                HStack(spacing: Spacing.s2) {
                    PlanBusinessLabelTag(kind: model.kind, text: model.businessLabelText ?? model.kind.title)
                    PlanPriceChip()
                }
                Text(model.title).planFont(.h3).foregroundStyle(Theme.Color.appText).fixedSize(horizontal: false, vertical: true)
                Text("\(PlanFormat.when(start: model.start, end: model.end)) · \(model.spots) spots")
                    .planFont(.small)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appTextSecondary)
                if let location = model.businessLocation {
                    Text(PlanBusinessLocationRow.line(location, business: model.hostAs))
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let business = model.hostAs {
                    HStack(spacing: 10) {
                        PlanBusinessShape(url: business.avatarUrl, size: 30)
                        Text(business.name).fontWeight(.semibold).planFont(.small).foregroundStyle(Theme.Color.appText)
                        if business.verified { PlanVerifiedBusinessLabel() }
                    }
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, 14)
            .padding(.bottom, Spacing.s4)
        }
        .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(Theme.Color.appSurface))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("planBusinessPreview")
    }
}

// MARK: - B3: posted

struct PlanBusinessPostedScreen: View {
    let plan: PlanDetailDTO
    let onSeePlan: () -> Void
    let onDone: () -> Void

    @State private var showsInvite = false
    @State private var toast: String?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var card: PlanCardDTO {
        plan.card
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    PlanBanner(tone: .success, icon: .check, title: postedTitle, message: PlanScreenLines.when(card))
                        .accessibilityIdentifier("planPostedBusiness")
                    Text.planOverline("What guests see")
                    guestCard
                    if card.invites?.canInvite == true || card.shareUrl != nil {
                        Text.planOverline("Bring your regulars")
                        regulars
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s6)
                .padding(.bottom, Spacing.s6)
            }
            VStack(spacing: Spacing.s1) {
                Button("Done", action: onDone)
                    .planButton(.primary)
                    .accessibilityIdentifier("planPostedDone")
                Button("See your plan", action: onSeePlan)
                    .planButton(.text, size: .extraSmall)
                    .accessibilityIdentifier("planPostedSee")
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(alignment: .top) { Divider().overlay(Theme.Color.appBorder) }
        }
        .background(Theme.Color.appBg)
        .overlay(alignment: .bottom) {
            if let toast {
                ToastView(message: ToastMessage(text: toast))
                    .padding(.bottom, 120)
                    .dismissToast(after: toast, minimum: 2.5) { self.toast = nil }
            }
        }
        .sheet(isPresented: $showsInvite) { PlanInviteSheet(card: card) }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planPosted")
    }

    /// "Your clinic is posted".
    private var postedTitle: String {
        "Your \(card.labelText?.lowercased() ?? "plan") is posted"
    }

    private var guestCard: some View {
        PlanCardBox(padding: Spacing.s4) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                PlanCardTag(card: card)
                Text(card.title).planFont(.h3).foregroundStyle(Theme.Color.appText).fixedSize(horizontal: false, vertical: true)
                Text("\(PlanScreenLines.when(card)) · \(card.spots) spots")
                    .planFont(.small)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Color.appTextStrong)
                Text([card.businessPlace?.name, card.businessPlace?.address ?? plan.place?.address].compactMap { $0 }
                    .joined(separator: " · "))
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var regulars: some View {
        PlanCardBox(padding: Spacing.s3) {
            VStack(spacing: 0) {
                if let url = card.shareUrl {
                    row(
                        icon: .link,
                        title: "Copy your link",
                        subtitle: "For your site, your texts, your front desk",
                        identifier: "planPostedCopyLink"
                    ) {
                        UIPasteboard.general.string = url
                        toast = "Link copied"
                    }
                }
                if card.invites?.canInvite == true {
                    if card.shareUrl != nil { Divider().overlay(Theme.Color.appBorder) }
                    row(icon: .mail, title: "Invite by email", subtitle: "Paste your customer list", identifier: "planPostedInviteEmail") {
                        showsInvite = true
                    }
                    Divider().overlay(Theme.Color.appBorder)
                    row(
                        icon: .users,
                        title: "Invite people who came before",
                        subtitle: "People who came to your plans",
                        identifier: "planPostedInvitePeople"
                    ) { showsInvite = true }
                }
            }
        }
    }

    private func row(icon: PantopusIcon, title: String, subtitle: String, identifier: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.s3) {
                RoundedRectangle(cornerRadius: 11, style: .continuous)
                    .fill(Theme.Color.primary100)
                    .frame(width: 38, height: 38)
                    .overlay(Icon(icon, size: 19, color: Theme.Color.primary700))
                VStack(alignment: .leading, spacing: 0) {
                    Text(title).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                    Text(subtitle).planFont(.small).foregroundStyle(Theme.Color.appTextSecondary).fixedSize(
                        horizontal: false,
                        vertical: true
                    )
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(.vertical, 10)
            .frame(minHeight: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier(identifier)
    }
}
