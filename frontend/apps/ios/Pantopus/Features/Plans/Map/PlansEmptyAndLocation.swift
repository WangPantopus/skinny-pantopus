//
//  PlansEmptyAndLocation.swift
//  Pantopus
//
//  Board F4 "Nothing planned yet": the next game as a watch-party nudge,
//  the other kinds to start, and "Invite a neighbor". Board F5 "See plans
//  near you": the location ask, with the home as the other choice.
//

import SwiftUI

struct PlansEmptyCard: View {
    let viewModel: PlansMapViewModel
    let actions: PlansMapActions
    @State private var flags = PlansFlags.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    Text("Nothing planned yet")
                        .planFont(.h3)
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Text("Plans here start with one neighbor. Yours could be the first.")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                watchNudge
                Text("Or start something else")
                    .planFont(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.top, 2)
                otherKinds
                Divider().overlay(Theme.Color.appBorder).padding(.top, Spacing.s1)
                if let elsewhere = viewModel.nearestElsewhere {
                    HStack(spacing: 10) {
                        Icon(.mapPin, size: 16, color: Theme.Color.appTextSecondary)
                        Text("\(elsewhere.count) plan\(elsewhere.count == 1 ? "" : "s") in \(elsewhere.city), \(elsewhere.miles) mi away")
                            .planFont(.small)
                            .foregroundStyle(Theme.Color.appText)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Button("Show") { viewModel.showElsewhere() }
                            .planFont(.smallStrong)
                            .foregroundStyle(Theme.Color.primaryInk)
                            .frame(minHeight: 44)
                            .accessibilityIdentifier("plansShowElsewhere")
                    }
                }
                ShareLink(
                    item: URL(string: "https://pantopus.com/start") ?? URL(fileURLWithPath: "/"),
                    message: Text("I'm on Pantopus to make small plans with neighbors. Join me.")
                ) {
                    PlanButtonLabel(title: "Invite a neighbor", icon: .share, kind: .secondary)
                }
                .planButton(.secondary, size: .small)
                .accessibilityIdentifier("plansInviteNeighbor")
            }
            .padding(.bottom, Spacing.s4)
        }
        .scrollIndicators(.hidden)
        .accessibilityIdentifier("plansEmpty")
    }

    /// "Seahawks play Sunday at 1:25 · Host a watch party", from the next
    /// game on the checked list; without one, the plain invitation.
    private var watchNudge: some View {
        let game = viewModel.games.first
        return Button {
            actions.host(PlansHostStart(kind: .watchParty, game: game))
        } label: {
            HStack(spacing: Spacing.s3) {
                PlanSwatch(kind: .watchParty, size: 40, glyph: 20)
                VStack(alignment: .leading, spacing: 0) {
                    Text(game.map(gameLine) ?? "Watch a game together")
                        .planFont(.bodyStrong)
                        .foregroundStyle(Theme.Color.appText)
                        .multilineTextAlignment(.leading)
                    Text("Host a watch party")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
            }
            .padding(14)
            .background(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).fill(PlanKind.watchParty.tint))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("plansEmptyWatch")
    }

    /// "Seahawks play Sunday at 1:25".
    private func gameLine(_ game: PlanGameOptionDTO) -> String {
        guard let start = game.startsAtDate else { return "\(game.label) play soon" }
        let day = PlanFormat.dayHeading(start)
        let when = day == "Today" ? "today" : day == "Tomorrow" ? "tomorrow" : day
        let time = PlanFormat.time(start).replacingOccurrences(of: " PM", with: "").replacingOccurrences(of: " AM", with: "")
        return "\(game.label) play \(when) at \(time)"
    }

    private var otherKinds: some View {
        let kinds = PlanKind.displayOrder.filter { $0 != .watchParty && ($0 != .playdate || flags.playdates) }
        return HStack(spacing: Spacing.s2) {
            ForEach(kinds) { kind in
                Button { actions.host(PlansHostStart(kind: kind)) } label: {
                    VStack(spacing: Spacing.s1) {
                        PlanSwatch(kind: kind)
                        Text(kind.title)
                    }
                }
                .planButton(.tonal, size: .stack)
                .accessibilityLabel("Host a \(kind.spokenTitle.lowercased())")
            }
        }
    }
}

struct PlansLocationCard: View {
    let viewModel: PlansMapViewModel
    @State private var isAsking = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .fill(Theme.Color.primary100)
                    .frame(width: 52, height: 52)
                    .overlay(Icon(.locationArrow, size: 28, color: Theme.Color.primary700))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 6) {
                    Text("See plans near you")
                        .planFont(.h2)
                        .foregroundStyle(Theme.Color.appText)
                        .accessibilityAddTraits(.isHeader)
                    Text("Pantopus uses your location to show what neighbors are planning close by.")
                        .planFont(.body)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                PlanScopeLine(text: "Hosts and guests never see where you are. They see a distance like \u{201C}about 1 mi\u{201D}.")
                if viewModel.locationUnavailable {
                    Text(viewModel.homeCenter == nil
                        ? "Location is off for Pantopus. You can turn it on in Settings."
                        : "Location is off for Pantopus. You can use your home instead.")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.warning)
                        .fixedSize(horizontal: false, vertical: true)
                }
                VStack(spacing: Spacing.s2) {
                    Button {
                        Task {
                            isAsking = true
                            await viewModel.useMyLocation()
                            isAsking = false
                        }
                    } label: {
                        PlanButtonLabel(title: "Use my location", kind: .primary, isLoading: isAsking)
                    }
                    .planButton(.primary)
                    .disabled(isAsking)
                    .accessibilityIdentifier("plansUseLocation")
                    if viewModel.homeCenter != nil {
                        Button("Use my home instead") { Task { await viewModel.useHome() } }
                            .planButton(.secondary)
                            .accessibilityIdentifier("plansUseHome")
                    }
                    if viewModel.locationUnavailable, viewModel.homeCenter == nil {
                        Button("Open Settings") {
                            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                        }
                        .planButton(.text)
                    }
                }
                .padding(.top, Spacing.s1)
            }
            .padding(.top, Spacing.s1)
            .padding(.bottom, Spacing.s4)
        }
        .scrollIndicators(.hidden)
        .accessibilityIdentifier("plansNeedsLocation")
    }
}
