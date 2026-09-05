//
//  AddressTodayTabView.swift
//  Pantopus
//
//  The Today tab as its own screen (Wedge v2 D2): weather now, what to do
//  with it, the address calendar, then air, alerts and sun, for the
//  person's primary place. The hub briefing (`TodayDetailView`) is still
//  reachable from a morning-push deep link; this is what the tab shows
//  on its own. Parity twin of Android's `TodayTabScreen`.
//

import SwiftUI

struct AddressTodayTabView: View {
    @Environment(RootTabModel.self) private var rootTabs
    @State private var homeId: String?
    @State private var resolved = false
    @State private var loadFailed = false
    @State private var detail: PlaceDetailViewModel?

    var body: some View {
        VStack(spacing: 0) {
            header
            content
        }
        .background(Theme.Color.appBg)
        .task { await resolveHome() }
        .accessibilityIdentifier("addressTodayTab")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Today")
                .font(.system(size: 22, weight: .bold))
                .kerning(-0.4)
                .foregroundStyle(Theme.Color.appText)
            if let address {
                Text(address)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
    }

    private var address: String? {
        if let detail, case let .loaded(intel) = detail.state { return placeDetailAddress(intel.place) }
        return nil
    }

    @ViewBuilder
    private var content: some View {
        if !resolved {
            PlaceDetailSkeleton()
        } else if let detail {
            AddressTodayLoaded(viewModel: detail)
        } else if loadFailed {
            couldNotLoad
        } else {
            noPlace
        }
    }

    /// No claimed place yet: Today starts at an address, so send them to claim one.
    private var noPlace: some View {
        VStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Theme.Color.homeBg)
                Icon(.cloudSun, size: 28, strokeWidth: 2, color: Theme.Color.home)
            }
            .frame(width: 56, height: 56)
            Text("Today starts at your address")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text(
                "Weather, air, alerts, and the dates that matter at your address — pickup day, tax deadlines, council meetings. Claim your address to start."
            )
            .font(.system(size: 14))
            .lineSpacing(3)
            .multilineTextAlignment(.center)
            .foregroundStyle(Theme.Color.appTextSecondary)
            PrimaryButton(title: "Claim your address") { rootTabs.selected = .place }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .padding(.horizontal, 16)
        .frame(maxHeight: .infinity, alignment: .top)
        .accessibilityIdentifier("addressTodayNoPlace")
    }

    /// Could not ask which home is primary (offline, a dead spot, a 5xx).
    /// This is not "no home": say so and offer a retry rather than sending
    /// a verified resident off to claim an address they already own.
    private var couldNotLoad: some View {
        VStack(spacing: 10) {
            Text("Couldn't load your place")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Text("Check your connection and try again.")
                .font(.system(size: 14))
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Color.appTextSecondary)
            PrimaryButton(title: "Try again") { Task { await resolveHome(force: true) } }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .padding(.horizontal, 16)
        .frame(maxHeight: .infinity, alignment: .top)
        .accessibilityIdentifier("addressTodayLoadFailed")
    }

    private func resolveHome(force: Bool = false) async {
        // A failed lookup never latches: it retries on the next appearance
        // or on the button. A successful one is final for this view's life.
        guard force || !resolved || loadFailed else { return }
        resolved = false
        loadFailed = false
        do {
            let response: MyHomesResponse = try await APIClient.shared.request(HomesEndpoints.myHomes())
            let id = response.homes.first { $0.isPrimaryOwner == true }?.id ?? response.homes.first?.id
            homeId = id
            if let id { detail = PlaceDetailViewModel(homeId: id, group: .today) }
        } catch is CancellationError {
            // The view went away mid-request; the next appearance asks again.
            return
        } catch {
            loadFailed = true
        }
        resolved = true
    }
}

/// The loaded Today content, driven by the same view model as the Place
/// detail page so the calendar's pickup-day picker keeps working.
private struct AddressTodayLoaded: View {
    @State var viewModel: PlaceDetailViewModel

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                PlaceDetailSkeleton()
            case let .loaded(intel):
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        PlaceTodayDetailContent(intel: intel, vm: viewModel)
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, Spacing.s10)
                }
                .refreshable { await viewModel.refresh() }
            case let .error(message):
                ErrorState(message: message) { await viewModel.refresh() }
            }
        }
        .task { await viewModel.load() }
    }
}
