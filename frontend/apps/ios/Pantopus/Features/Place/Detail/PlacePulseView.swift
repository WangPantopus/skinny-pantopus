//
//  PlacePulseView.swift
//  Pantopus
//
//  C10 — Today's Pulse, the priority-ranked signal stream (GET
//  /api/ai/pulse). Reached from the dashboard hero. Renders the
//  all-clear summary when the block is quiet, else the ranked signals
//  bucketed into tiers (urgent → worth a look → around you → when you
//  have a minute), ported from the web `PulseStreamView` + `ranking.ts`.
//

import SwiftUI

@Observable
@MainActor
final class PlacePulseViewModel {
    enum State {
        case loading
        case loaded(PulsePayload)
        case error(message: String)
    }

    private(set) var state: State = .loading
    let homeId: String
    private let api: APIClient

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    func load() async {
        if case .loaded = state { return }
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let response: NeighborhoodPulse = try await api.request(AIEndpoints.pulse(homeId: homeId))
            state = .loaded(response.pulse)
        } catch let error as APIError {
            state = .error(message: error.errorDescription ?? "Couldn't load your pulse.")
        } catch {
            state = .error(message: "Couldn't load your pulse.")
        }
    }
}

struct PlacePulseView: View {
    @State private var viewModel: PlacePulseViewModel
    var onBack: () -> Void

    init(viewModel: PlacePulseViewModel, onBack: @escaping () -> Void) {
        _viewModel = State(initialValue: viewModel)
        self.onBack = onBack
    }

    var body: some View {
        VStack(spacing: 0) {
            PlaceDetailHeader(title: "Today's Pulse", address: subtitle, onBack: onBack)
            content
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .task { await viewModel.load() }
    }

    private var subtitle: String {
        if case let .loaded(pulse) = viewModel.state { return pulse.greeting }
        return ""
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            PlaceDetailSkeleton()
        case let .loaded(pulse):
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if pulse.signals.isEmpty {
                        allClear(pulse)
                    } else {
                        tiers(pulse)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, Spacing.s10)
            }
        case let .error(message):
            ErrorState(message: message) { await viewModel.refresh() }
        }
    }

    private func allClear(_ pulse: PulsePayload) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            PlaceDetailSectionLabel(text: "Today")
            PlaceDetailCard {
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(Theme.Color.homeBg)
                        Icon(.shieldCheck, size: 24, strokeWidth: 2, color: Theme.Color.home)
                    }
                    .frame(width: 48, height: 48)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("All clear today")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        Text(pulse.summary)
                            .font(.system(size: 13.5))
                            .lineSpacing(2)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
    }

    private func tiers(_ pulse: PulsePayload) -> some View {
        let sorted = pulse.signals.sorted { $0.priority > $1.priority }
        let buckets: [(String, [PulseSignal])] = [
            ("Urgent", sorted.filter { $0.priority >= 80 }),
            ("Worth a look", sorted.filter { $0.priority >= 50 && $0.priority < 80 }),
            ("Around you", sorted.filter { $0.priority >= 25 && $0.priority < 50 }),
            ("When you have a minute", sorted.filter { $0.priority < 25 })
        ]
        return VStack(alignment: .leading, spacing: 0) {
            ForEach(buckets, id: \.0) { title, signals in
                if !signals.isEmpty {
                    PlaceDetailSectionLabel(text: title)
                    VStack(spacing: 8) {
                        ForEach(Array(signals.enumerated()), id: \.offset) { _, signal in
                            SignalCard(signal: signal)
                        }
                    }
                }
            }
        }
    }
}

private struct SignalCard: View {
    let signal: PulseSignal

    var body: some View {
        PlaceDetailCard(padding: 14) {
            HStack(alignment: .top, spacing: 11) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous).fill(tone.bg)
                    Icon(icon, size: 18, strokeWidth: 2, color: tone.fg)
                }
                .frame(width: 36, height: 36)
                VStack(alignment: .leading, spacing: 3) {
                    Text(signal.title)
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(signal.detail)
                        .font(.system(size: 13))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    if let action = signal.actions?.first {
                        Text(action.label)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.Color.primary600)
                            .padding(.top, 2)
                    }
                }
                Spacer(minLength: 0)
            }
        }
    }

    private var icon: PantopusIcon {
        PantopusIcon(rawValue: signal.icon) ?? .mapPin
    }

    private var tone: (bg: Color, fg: Color) {
        switch signal.color.lowercased() {
        case "green", "home", "success": (Theme.Color.homeBg, Theme.Color.home)
        case "amber", "warning", "yellow", "orange": (Theme.Color.warningBg, Theme.Color.warning)
        case "red", "error": (Theme.Color.errorBg, Theme.Color.error)
        case "sky", "blue", "primary": (Theme.Color.primary100, Theme.Color.primary600)
        default: (Theme.Color.appSurfaceSunken, Theme.Color.appTextSecondary)
        }
    }
}
