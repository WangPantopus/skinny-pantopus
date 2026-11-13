//
//  PlanComposerRoot.swift
//  Pantopus
//
//  Hosting, start to finish: H1 pick a type, H2 to H5 the details, H6 the
//  place, H7 the preview, H8 posted. Presented over Nearby; it ends on the
//  plan ("See your plan") or back on the map ("Done").
//

import SwiftUI

enum PlanComposerStep: Hashable {
    case details
    case preview
}

struct PlanComposerRoot: View {
    @State private var model: PlanComposerModel
    @State private var path: [PlanComposerStep] = []
    @State private var flags = PlansFlags.shared
    /// The posted plan's id to open, or nil to go back to the map.
    let onFinish: (String?) -> Void

    init(start: PlansHostStart?, onFinish: @escaping (String?) -> Void) {
        _model = State(initialValue: PlanComposerModel(start: start))
        // "Host again" (A5) opens on the preview of the same plan next week.
        _path = State(initialValue: start?.again != nil ? [.preview] : [])
        self.onFinish = onFinish
        startsAtDetails = start != nil
    }

    private let startsAtDetails: Bool

    var body: some View {
        Group {
            if let posted = model.posted, posted.card.isBusiness {
                // Posted as a business (board B3): bring your regulars.
                PlanBusinessPostedScreen(plan: posted, onSeePlan: { onFinish(posted.id) }, onDone: { onFinish(nil) })
            } else if let posted = model.posted {
                PlanPostedScreen(plan: posted, onSeePlan: { onFinish(posted.id) }, onDone: { onFinish(nil) })
            } else {
                NavigationStack(path: $path) {
                    Group {
                        if startsAtDetails {
                            // The type is already chosen (F4, "Host again"): still step 2 of 3, as the boards and Android count.
                            PlanDetailsForm(
                                model: model,
                                step: "2 of 3",
                                onBack: { onFinish(nil) },
                                onPreview: { openPreview() }
                            )
                        } else {
                            PlanTypePicker(
                                showsPlaydates: flags.playdates,
                                model: model,
                                onClose: { onFinish(nil) },
                                onPick: { kind in
                                    // Anyone on Pantopus may host a playdate (founder decision, November 7).
                                    model.choose(kind)
                                    path.append(.details)
                                }
                            )
                        }
                    }
                    .readableColumn()
                    .toolbar(.hidden, for: .navigationBar)
                    .swipesBackFromEdge()
                    .navigationDestination(for: PlanComposerStep.self) { step in
                        switch step {
                        case .details:
                            PlanDetailsForm(
                                model: model,
                                step: "2 of 3",
                                onBack: { path.removeLast() },
                                onPreview: { openPreview() }
                            )
                            .readableColumn()
                            .toolbar(.hidden, for: .navigationBar)
                        case .preview:
                            PlanPreviewScreen(model: model, step: "3 of 3") { path.removeLast() }
                                .readableColumn()
                                .toolbar(.hidden, for: .navigationBar)
                        }
                    }
                }
            }
        }
        .task {
            await model.load()
            // The places around the host start loading now, so H6 usually opens on a full list.
            await PlanPlacesWarmup.start(home: model.home)
        }
    }

    /// H7 opens without the last attempt's refusal (as on Android): the host may have fixed it.
    private func openPreview() {
        model.postError = nil
        path.append(.preview)
    }
}

// MARK: - H1

struct PlanTypePicker: View {
    let showsPlaydates: Bool
    /// The draft: "Host as" (Plans with businesses, board B1) reads and sets its business.
    var model: PlanComposerModel?
    let onClose: () -> Void
    let onPick: (PlanKind) -> Void

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar(title: "Host a plan", leading: .close, trailing: "1 of 3", onLeading: onClose)
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    if let model, !model.hostAsOptions.isEmpty { PlanHostAsSection(model: model) }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("What are you planning?")
                            .planFont(.h1)
                            .foregroundStyle(Theme.Color.appText)
                            .accessibilityAddTraits(.isHeader)
                        Text("Pick one. You can change the details next.")
                            .planFont(.body)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    LazyVGrid(columns: columns, spacing: Spacing.s3) {
                        ForEach(kinds) { kind in card(kind) }
                    }
                    Text(business == nil
                        ? "Plans are free and for adults. Kids come with a parent."
                        : "These are the five kinds of plan neighbors host. Yours keeps the same color and pin.")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s3)
                .padding(.bottom, Spacing.s6)
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planTypePicker")
    }

    private var kinds: [PlanKind] {
        // A business posts only the kinds the server lists for it (kids' plans have their own switch).
        if let business { return PlanKind.displayOrder.filter { business.kind($0) != nil } }
        return PlanKind.displayOrder.filter { $0 != .playdate || showsPlaydates }
    }

    private var business: PlanHostAsBusinessDTO? {
        model?.hostAs
    }

    /// Two columns; one at the largest text sizes.
    private var columns: [GridItem] {
        typeSize.isAccessibilitySize
            ? [GridItem(.flexible())]
            : [GridItem(.flexible(), spacing: Spacing.s3), GridItem(.flexible(), spacing: Spacing.s3)]
    }

    private func card(_ kind: PlanKind) -> some View {
        Button { onPick(kind) } label: {
            VStack(alignment: .leading, spacing: 10) {
                PlanTile(kind: kind, size: 52, glyph: 28)
                Text(business?.kind(kind)?.name ?? kind.title).planFont(.h4).foregroundStyle(Theme.Color.appText)
                Text(business == nil ? Self.blurb(kind) : Self.businessBlurb(kind))
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                if kind == .playdate, business == nil {
                    HStack(spacing: Spacing.s2) {
                        Icon(.shieldCheck, size: 14, color: Theme.Color.appTextSecondary)
                        Text("You approve each family")
                            .planFont(.footnote)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(Spacing.s4)
            .frame(maxWidth: .infinity, minHeight: 168, alignment: .topLeading)
            .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(Theme.Color.appSurface))
            .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("planType.\(kind.rawValue)")
    }

    /// What each kind is for a business (board B1).
    static func businessBlurb(_ kind: PlanKind) -> String {
        switch kind {
        case .watchParty: "A game on your screens"
        case .playdate: "A class, open play, story time"
        case .pickupGame: "A clinic, open play, league night"
        case .walkCoffee: "A meetup, a tasting, a group walk"
        case .studyGroup: "Tutoring, test prep, a workshop"
        }
    }

    static func blurb(_ kind: PlanKind) -> String {
        switch kind {
        case .watchParty: "Watch a game together, at home or out"
        case .playdate: "Kids play, parents meet"
        case .pickupGame: "Need players, now or later"
        case .walkCoffee: "Walks, dog walks, coffee"
        case .studyGroup: "Study together at a library or café"
        }
    }
}
