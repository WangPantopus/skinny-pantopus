//
//  MomentsMapChromeOpen.swift
//  Pantopus
//
//  The bottom of the Moments map on the open iPhone Duo (boards O1, O4,
//  O10, U1): the strip of faces becomes one glass pill at the bottom left,
//  "9 new near you · Play all"; Show my location and + stay at the bottom
//  right. Nothing in view, the phone's empty card takes the pill's place,
//  358 pt wide, as do the location and load-failed cards. While a card is
//  open beside the map, they all step aside (board O2).
//

import SwiftUI

struct MomentsMapOpenBottom: View {
    let viewModel: MomentsMapViewModel
    let postings: [MomentPosting]
    let actions: MomentsMapActions
    /// A card is open beside the map.
    let hidden: Bool
    /// The bottom-left card's height, for the map to keep its Legal link just above it.
    let onLeftCardHeight: (CGFloat) -> Void

    var body: some View {
        HStack(alignment: .bottom, spacing: Spacing.s3) {
            leading
                .frame(maxWidth: MomentsMapView.openRowWidth, alignment: .leading)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { onLeftCardHeight($0) }
            Spacer(minLength: 0)
            if viewModel.phase == .ready {
                VStack(alignment: .trailing, spacing: Spacing.s3) {
                    MomentsRoundButton.locate { Task { await viewModel.locate() } }
                    MomentsRoundButton.add(action: actions.compose)
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s3)
        .opacity(hidden ? 0 : 1)
        .allowsHitTesting(!hidden)
        .accessibilityHidden(hidden)
    }

    @ViewBuilder
    private var leading: some View {
        switch viewModel.phase {
        case .locating:
            EmptyView()
        case .needsLocation:
            MomentsLocationCard(viewModel: viewModel)
        case .ready:
            if viewModel.loadFailed, !viewModel.loaded, postings.isEmpty {
                MomentsLoadFailedCard { Task { await viewModel.load() } }
            } else if viewModel.isEmpty, postings.isEmpty {
                MomentsEmptyCard(line: viewModel.emptyLine, onAdd: actions.compose)
            } else {
                MomentsNewPill(viewModel: viewModel, actions: actions)
            }
        }
    }
}

/// Board O1: "9 new near you", a rule, and Play all, in one 52-pt glass pill.
struct MomentsNewPill: View {
    let viewModel: MomentsMapViewModel
    let actions: MomentsMapActions
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let rings = viewModel.stripRings
        let new = rings.filter { $0.isNew && !$0.mine }
        HStack(spacing: 6) {
            Text(title(rings: rings))
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(1)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("moments.newPill.title")
            if !rings.isEmpty {
                Rectangle()
                    .fill(Theme.Color.appText.opacity(colorScheme == .dark ? 0.18 : 0.14))
                    .frame(width: 1, height: 20)
                    .padding(.leading, Spacing.s2)
                    .accessibilityHidden(true)
                Button {
                    // As the strip's Play all: the new ones, nearest first; all of them once everything is watched.
                    actions.watch(new.isEmpty ? rings : new, 0, !new.isEmpty)
                } label: {
                    HStack(spacing: 6) {
                        Icon(.play, size: 12, color: Theme.Color.primaryTint)
                        Text("Play all").font(.system(size: 15, weight: .semibold))
                    }
                    .foregroundStyle(Theme.Color.primaryTint)
                    .padding(.horizontal, Spacing.s3)
                    .frame(height: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("moments.newPill.playAll")
            }
        }
        .padding(.leading, 18)
        .padding(.trailing, 6)
        .frame(height: 52)
        .momentsGlass(Capsule())
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Moments in view")
        .accessibilityIdentifier("moments.newPill")
    }

    /// The strip's title (board M1): new people in view, never yourself; zoomed into a crowded spot (held upright,
    /// where no card opens beside the map), the spot's name, as the strip says it (M2).
    private func title(rings: [MomentRingDTO]) -> String {
        if let focus = viewModel.focus { return focus.title }
        let new = MomentsMapViewModel.newPeople(in: rings)
        if !viewModel.loaded { return "Moments near you" }
        if new > 0 { return "\(new) new near you" }
        if rings.isEmpty { return "Posting your Moment" }
        return "All caught up near you"
    }
}

/// Board O10's posting ring, on the open Duo where there's no strip to retry from: a ring that didn't post asks,
/// as the strip's cell does on the phone.
struct MomentsPostingPinButton: View {
    let posting: MomentPosting
    let me: MomentAuthorDTO?
    let onRetry: @MainActor (String) -> Void
    let onDiscard: @MainActor (String) -> Void
    @State private var asking = false

    var body: some View {
        if case let .failed(message) = posting.phase {
            Button { asking = true } label: { MomentsPostingPin(posting: posting, me: me) }
                .buttonStyle(.plain)
                .accessibilityHint("Try again or discard")
                .confirmationDialog("Your Moment didn't post", isPresented: $asking, titleVisibility: .visible) {
                    Button("Try again") { onRetry(posting.id) }
                    Button("Discard", role: .destructive) { onDiscard(posting.id) }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text(message)
                }
        } else {
            MomentsPostingPin(posting: posting, me: me)
        }
    }
}
