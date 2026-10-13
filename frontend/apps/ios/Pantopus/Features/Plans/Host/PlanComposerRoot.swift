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
            if let posted = model.posted {
                PlanPostedScreen(plan: posted, onSeePlan: { onFinish(posted.id) }, onDone: { onFinish(nil) })
            } else {
                NavigationStack(path: $path) {
                    Group {
                        if startsAtDetails {
                            PlanDetailsForm(
                                model: model,
                                step: "1 of 2",
                                onBack: { onFinish(nil) },
                                onPreview: { path.append(.preview) }
                            )
                        } else {
                            PlanTypePicker(
                                showsPlaydates: flags.playdates,
                                onClose: { onFinish(nil) },
                                onPick: { kind in
                                    model.kind = kind
                                    path.append(.details)
                                }
                            )
                        }
                    }
                    .toolbar(.hidden, for: .navigationBar)
                    .navigationDestination(for: PlanComposerStep.self) { step in
                        switch step {
                        case .details:
                            PlanDetailsForm(
                                model: model,
                                step: "2 of 3",
                                onBack: { path.removeLast() },
                                onPreview: { path.append(.preview) }
                            )
                            .toolbar(.hidden, for: .navigationBar)
                        case .preview:
                            PlanPreviewScreen(model: model, step: startsAtDetails ? "2 of 2" : "3 of 3") { path.removeLast() }
                                .toolbar(.hidden, for: .navigationBar)
                        }
                    }
                }
            }
        }
        .task { await model.load() }
    }
}

// MARK: - H1

struct PlanTypePicker: View {
    let showsPlaydates: Bool
    let onClose: () -> Void
    let onPick: (PlanKind) -> Void

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar(title: "Host a plan", leading: .close, trailing: "1 of 3", onLeading: onClose)
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
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
                    Text("Plans are free and for adults. Kids come with a parent.")
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
        .accessibilityIdentifier("planTypePicker")
    }

    private var kinds: [PlanKind] {
        PlanKind.displayOrder.filter { $0 != .playdate || showsPlaydates }
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
                Text(kind.title).planFont(.h4).foregroundStyle(Theme.Color.appText)
                Text(Self.blurb(kind))
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                if kind == .playdate {
                    HStack(spacing: Spacing.s2) {
                        Icon(.shieldCheck, size: 14, color: Theme.Color.appTextSecondary)
                        Text("Verified neighbors only").planFont(.footnote).foregroundStyle(Theme.Color.appTextSecondary)
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

    static func blurb(_ kind: PlanKind) -> String {
        switch kind {
        case .watchParty: "Watch a game together, at home or out"
        case .playdate: "Kids play, parents meet"
        case .pickupGame: "Need players, now or later"
        case .walkCoffee: "Walks, dog walks, coffee"
        }
    }
}
