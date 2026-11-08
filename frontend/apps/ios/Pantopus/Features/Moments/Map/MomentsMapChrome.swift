//
//  MomentsMapChrome.swift
//  Pantopus
//
//  What floats over the Moments map: ☰, the area pill (M2: "‹ Esther Short
//  Park", back to the area) and the chat button at the top; "Show my
//  location", + and the strip at the bottom (M1, P5), or the empty card
//  (M3), or the location ask when there's neither a location nor a home.
//

import SwiftUI

struct MomentsMapTopBar: View {
    let viewModel: MomentsMapViewModel
    let onArea: @MainActor () -> Void
    let onBack: @MainActor () -> Void

    var body: some View {
        // ☰ first and the chat button last (founder decision 2026-11-08).
        HStack(spacing: Spacing.s2) {
            NavigationMenuButton(accessibilityIdentifier: "moments.menu", floating: true)
            if let focus = viewModel.focus {
                backPill(focus)
            } else {
                areaPill
            }
            MessagesButton(accessibilityIdentifier: "moments.chat", floating: true)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s1)
    }

    private var areaName: String {
        viewModel.areaName ?? "Near you"
    }

    private var areaPill: some View {
        Button(action: onArea) {
            HStack(spacing: Spacing.s2) {
                Text(areaName)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronDown, size: 16, color: Theme.Color.appText)
            }
            .padding(.horizontal, Spacing.s4)
            .frame(height: 48)
            .momentsGlass(Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Area: \(areaName). Change the area")
        .accessibilityIdentifier("moments.areaPill")
    }

    /// Board M2: the spot's name, and back to the area.
    private func backPill(_ focus: MomentsFocus) -> some View {
        Button(action: onBack) {
            HStack(spacing: 6) {
                Icon(.chevronLeft, size: 18, strokeWidth: 2.25, color: Theme.Color.appText)
                Text(focus.title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.leading, Spacing.s3)
            .padding(.trailing, Spacing.s4)
            .frame(height: 48)
            .momentsGlass(Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Back to \(areaName)")
        .accessibilityIdentifier("moments.clusterBack")
    }
}

// MARK: - Bottom

struct MomentsMapBottom: View {
    let viewModel: MomentsMapViewModel
    let postings: [MomentPosting]
    let me: MomentAuthorDTO?
    let actions: MomentsMapActions
    let onRetry: @MainActor (String) -> Void
    let onDiscard: @MainActor (String) -> Void

    var body: some View {
        VStack(alignment: .trailing, spacing: 0) {
            switch viewModel.phase {
            case .locating:
                EmptyView()
            case .needsLocation:
                MomentsLocationCard(viewModel: viewModel)
            case .ready:
                MomentsRoundButton.locate { Task { await viewModel.locate() } }
                if viewModel.loadFailed, !viewModel.loaded, postings.isEmpty {
                    MomentsLoadFailedCard { Task { await viewModel.load() } }
                        .padding(.top, 14)
                } else if viewModel.isEmpty, postings.isEmpty {
                    MomentsEmptyCard(place: viewModel.areaName, onAdd: actions.compose)
                        .padding(.top, 14)
                } else {
                    MomentsRoundButton.add(action: actions.compose)
                        .padding(.top, Spacing.s3)
                    MomentsStrip(
                        viewModel: viewModel,
                        postings: postings,
                        me: me,
                        actions: actions,
                        onRetry: onRetry,
                        onDiscard: onDiscard
                    )
                    .padding(.top, 9)
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s3)
    }
}

/// "Show my location" (48 pt glass) and + (60 pt, primary).
enum MomentsRoundButton {
    static func locate(action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Icon(.locationArrow, size: 20, color: Theme.Color.primaryTint)
                .frame(width: Spacing.s12, height: Spacing.s12)
                .momentsGlass(Circle())
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Show my location")
        .accessibilityIdentifier("moments.locate")
    }

    static func add(action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Icon(.plus, size: 26, strokeWidth: 2.5, color: .white)
                .frame(width: 60, height: 60)
                .background(Circle().fill(Theme.Color.primarySolid))
                .shadow(color: Theme.Color.primarySolid.opacity(0.45), radius: 7, x: 0, y: 4)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add a Moment")
        .accessibilityIdentifier("moments.add")
    }
}

// MARK: - Strip

/// Boards M1 and M2: "8 new near you" (or the spot's name and "5 people · 3
/// new") with Play all, over the faces in view, new ones first, then nearest.
struct MomentsStrip: View {
    let viewModel: MomentsMapViewModel
    let postings: [MomentPosting]
    let me: MomentAuthorDTO?
    let actions: MomentsMapActions
    let onRetry: @MainActor (String) -> Void
    let onDiscard: @MainActor (String) -> Void
    @State private var failedPosting: MomentPosting?

    var body: some View {
        let rings = viewModel.stripRings
        VStack(spacing: 0) {
            header(rings)
                .frame(height: 44)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 2) {
                    ForEach(postings) { posting in postingCell(posting) }
                    if !viewModel.loaded, postings.isEmpty {
                        ForEach(0..<5, id: \.self) { _ in placeholderCell }
                    }
                    ForEach(Array(rings.enumerated()), id: \.element.id) { index, ring in
                        Button { actions.watch(rings, index, false) } label: { MomentStripFace(ring: ring) }
                            .buttonStyle(.plain)
                            .accessibilityLabel(MomentsSpeech.label(for: ring))
                            .accessibilityIdentifier("moments.strip.ring.\(ring.id)")
                    }
                }
                .padding(.horizontal, Spacing.s2)
                .padding(.top, 2)
            }
            .frame(maxHeight: .infinity, alignment: .top)
        }
        .frame(height: 136)
        .momentsGlass(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(viewModel.focus.map { "Moments at \($0.title)" } ?? "Moments in view")
        .accessibilityIdentifier("moments.strip")
        .confirmationDialog(
            "Your Moment didn't post",
            isPresented: Binding(get: { failedPosting != nil }, set: { if !$0 { failedPosting = nil } }),
            titleVisibility: .visible,
            presenting: failedPosting
        ) { posting in
            Button("Try again") { onRetry(posting.id) }
            Button("Discard", role: .destructive) { onDiscard(posting.id) }
            Button("Cancel", role: .cancel) {}
        } message: { posting in
            if case let .failed(message) = posting.phase { Text(message) }
        }
    }

    @ViewBuilder
    private func header(_ rings: [MomentRingDTO]) -> some View {
        let new = rings.filter(\.isNew)
        HStack(spacing: Spacing.s2) {
            if let focus = viewModel.focus {
                VStack(alignment: .leading, spacing: 1) {
                    Text(focus.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text("\(rings.count) \(rings.count == 1 ? "person" : "people")" + (new.isEmpty ? "" : " · \(new.count) new"))
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("moments.strip.title")
                .padding(.top, 2)
            } else {
                Text(title(rings: rings, new: new.count))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("moments.strip.title")
            }
            Spacer(minLength: 0)
            if !rings.isEmpty {
                Button {
                    // Play all plays the new ones, nearest first; all of them once everything is watched.
                    let queue = new.isEmpty ? rings : new
                    actions.watch(queue, 0, !new.isEmpty)
                } label: {
                    HStack(spacing: 6) {
                        Icon(.play, size: 12, color: Theme.Color.primaryTint)
                        Text("Play all").font(.system(size: 15, weight: .semibold))
                    }
                    .foregroundStyle(Theme.Color.primaryTint)
                    .padding(.horizontal, 10)
                    .frame(height: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("moments.playAll")
            }
        }
        .padding(.leading, Spacing.s4)
        .padding(.trailing, 6)
        .padding(.top, Spacing.s1)
    }

    private func title(rings: [MomentRingDTO], new: Int) -> String {
        if !viewModel.loaded { return "Moments near you" }
        if new > 0 { return "\(new) new near you" }
        if rings.isEmpty { return "Posting your Moment" }
        return "All watched near you"
    }

    private func postingCell(_ posting: MomentPosting) -> some View {
        let failed = if case .failed = posting.phase { true } else { false }
        return Button {
            if failed { failedPosting = posting }
        } label: {
            VStack(spacing: Spacing.s1) {
                MomentPostingRing(progress: posting.progress, avatar: me, asPin: false)
                Text(failed ? "Try again" : "Posting")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(failed ? Theme.Color.error : Theme.Color.primaryTint)
                    .lineLimit(1)
            }
            .frame(width: 62)
        }
        .buttonStyle(.plain)
        .disabled(!failed)
        .accessibilityLabel(failed ? "Your Moment didn't post. Try again" : "Your Moment is posting")
        .accessibilityIdentifier("moments.strip.posting")
    }

    private var placeholderCell: some View {
        VStack(spacing: Spacing.s1) {
            Circle().fill(Theme.Color.appSurfaceSunken).frame(width: 56, height: 56)
            Capsule().fill(Theme.Color.appSurfaceSunken).frame(width: 40, height: 10)
        }
        .frame(width: 62)
        .accessibilityHidden(true)
    }
}

// MARK: - Empty and location

/// Board M3: nothing in view.
struct MomentsEmptyCard: View {
    let place: String?
    let onAdd: @MainActor () -> Void

    var body: some View {
        MomentsMapCard(
            icon: .circleDashed,
            title: "Nothing here right now",
            line: "Share what's happening at \(place ?? "this spot").",
            button: "Add a Moment",
            buttonIcon: .plus,
            buttonId: "moments.empty.add",
            action: onAdd
        )
        .accessibilityIdentifier("moments.empty")
    }
}

/// The first read of the rings failed (offline, the server busy).
struct MomentsLoadFailedCard: View {
    let onRetry: @MainActor () -> Void

    var body: some View {
        MomentsMapCard(
            icon: .wifiOff,
            title: "Couldn't load Moments",
            line: "Check your connection and try again.",
            button: "Try again",
            buttonIcon: nil,
            buttonId: "moments.retry",
            action: onRetry
        )
        .accessibilityIdentifier("moments.loadFailed")
    }
}

/// No location and no home: what the map needs to open somewhere.
struct MomentsLocationCard: View {
    let viewModel: MomentsMapViewModel

    var body: some View {
        MomentsMapCard(
            icon: .locationArrow,
            title: "See Moments near you",
            line: viewModel.locationUnavailable
                ? "Turn on location for Pantopus in Settings. Nobody sees where you are."
                : "Your location opens the map where you are. Nobody sees it.",
            button: "Use my location",
            buttonIcon: nil,
            buttonId: "moments.locationAsk.use"
        ) {
            Task { await viewModel.locate() }
        }
        .accessibilityIdentifier("moments.locationAsk")
    }
}

/// The glass card M3 draws: an icon, a title and a line, and one button.
private struct MomentsMapCard: View {
    let icon: PantopusIcon
    let title: String
    let line: String
    let button: String
    let buttonIcon: PantopusIcon?
    let buttonId: String
    let action: @MainActor () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: Spacing.s3) {
                Icon(icon, size: 22, color: Theme.Color.primaryTint)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(MomentsPalette.tint))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Text(line)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Button(action: action) {
                HStack(spacing: Spacing.s2) {
                    if let buttonIcon { Icon(buttonIcon, size: 18, strokeWidth: 2.5, color: .white) }
                    Text(button).font(.system(size: 16, weight: .semibold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(Capsule().fill(Theme.Color.primarySolid))
                .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier(buttonId)
        }
        .padding(18)
        .momentsGlass(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Glass

extension View {
    /// The boards' glass: the system material, a hairline, and a soft shadow.
    func momentsGlass(_ shape: some InsettableShape) -> some View {
        background(shape.fill(.regularMaterial))
            .overlay(shape.strokeBorder(Theme.Color.appBorderSubtle.opacity(0.6), lineWidth: 0.5))
            .shadow(color: .black.opacity(0.14), radius: 5, x: 0, y: 2)
    }
}
