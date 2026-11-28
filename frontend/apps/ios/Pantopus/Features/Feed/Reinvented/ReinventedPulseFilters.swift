//
//  ReinventedPulseFilters.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 5 piece B and phase 6 (PHASE-5 §2 B, PHASE-6 §2 A2; CONTRACT 10a), as the web's
//  (`filters.tsx`): the filters of the new Pulse, the same on the list and the map. What (kinds, several at once),
//  When (the map's time row: one setting for both), From (everyone or connections only) and State (unanswered Asks,
//  plans with room, new since your last visit). The choice is kept on this phone for this person, with the time they
//  last opened Pulse here ("new since your last visit" sends it as `since`). Heads-ups always show: the server keeps them
//  in. With nothing on, the list and the map send what they sent before. Only read while `pulse_reinvented` is on.
//

import Foundation
import Observation
import SwiftUI

struct ReinventedPulseFilters: Codable, Equatable {
    var kinds: [String] = []
    /// `everyone` or `connections`.
    var from = "everyone"
    /// `unanswered`, `room`.
    var state: [String] = []
    /// New since your last visit.
    var fresh = false

    static let none = ReinventedPulseFilters()
    static let kinds = ["live", "learn", "spots", "ask", "plans", "sports"]
}

@Observable
@MainActor
final class ReinventedPulseFilterStore {
    static let shared = ReinventedPulseFilterStore()

    private(set) var filters = ReinventedPulseFilters.none
    /// The last visit before this one, or nil the first time.
    private(set) var since: String?
    /// The kept When (the map's time row).
    private(set) var time = "live"
    @ObservationIgnored private var account: String?

    /// The When of the sheet: the map's time row's four that the list follows too.
    static let whens: [(time: String, title: String)] = [
        ("live", "Now"), ("today", "Today"), ("tonight", "Tonight"), ("weekend", "This weekend")
    ]

    /// Reads this person's kept choice (once per person) and keeps this visit as the next one's "last visit".
    func read() {
        var viewer: String?
        if case let .signedIn(user) = AuthManager.shared.state { viewer = user.id }
        guard let viewer, viewer != account else { return }
        account = viewer
        let defaults = UserDefaults.standard
        let last = defaults.string(forKey: Self.visitKey(viewer))
        since = last.flatMap { Self.iso.date(from: $0) == nil ? nil : $0 }
        defaults.set(Self.iso.string(from: Date()), forKey: Self.visitKey(viewer))
        var kept = ReinventedPulseFilters.none
        var keptTime: String?
        if let data = defaults.data(forKey: Self.filtersKey(viewer)),
           let saved = try? JSONDecoder().decode(Kept.self, from: data) {
            kept.kinds = saved.filters.kinds.filter(ReinventedPulseFilters.kinds.contains)
            kept.from = saved.filters.from == "connections" ? "connections" : "everyone"
            kept.state = saved.filters.state.filter { $0 == "unanswered" || $0 == "room" }
            kept.fresh = saved.filters.fresh && since != nil
            if ReinventedMapModel.times.contains(where: { $0.key == saved.time }) { keptTime = saved.time }
        }
        filters = kept
        time = keptTime ?? "live"
    }

    func set(_ filters: ReinventedPulseFilters) {
        self.filters = filters
        keep()
    }

    /// The map's time row moved (or the sheet's When): kept with the filters.
    func set(time: String) {
        guard time != self.time else { return }
        self.time = time
        keep()
    }

    func clear() {
        filters = .none
        keep()
    }

    /// How many are on, the When included when it isn't Now.
    func count(time: String) -> Int {
        filters.kinds.count + (filters.from == "connections" ? 1 : 0) + filters.state.count + (filters.fresh ? 1 : 0)
            + (time == "live" ? 0 : 1)
    }

    /// CONTRACT 10a's fields for the list (`when` too) or the map (its time row is its `time`). Nil when nothing is on,
    /// so the request is today's.
    func params(time: String, forList: Bool) -> [String: String]? {
        var query: [String: String] = [:]
        if !filters.kinds.isEmpty { query["kinds"] = filters.kinds.joined(separator: ",") }
        if forList, ["today", "tonight", "weekend"].contains(time) { query["when"] = time }
        if filters.from == "connections" { query["from"] = "connections" }
        if !filters.state.isEmpty { query["state"] = filters.state.joined(separator: ",") }
        if filters.fresh, let since { query["since"] = since }
        return query.isEmpty ? nil : query
    }

    /// The one plain line that says what is on: "Ask · Tonight".
    func words(time: String) -> String {
        var parts: [String] = []
        if !filters.kinds.isEmpty { parts.append(filters.kinds.map(Self.kindTitle).joined(separator: ", ")) }
        if time != "live" { parts.append(ReinventedMapModel.times.first { $0.key == time }?.title ?? time) }
        if filters.from == "connections" { parts.append("Connections only") }
        if filters.state.contains("unanswered") { parts.append("Unanswered Asks") }
        if filters.state.contains("room") { parts.append("Plans with room") }
        if filters.fresh { parts.append("New since your last visit") }
        return parts.joined(separator: " · ")
    }

    static func kindTitle(_ kind: String) -> String {
        switch kind {
        case "live": "Moments"
        case "learn": "Learn"
        case "spots": "Spots"
        case "ask": "Ask"
        case "plans": "Plans"
        case "sports": "Sports"
        default: kind.capitalized
        }
    }

    private struct Kept: Codable {
        let filters: ReinventedPulseFilters
        let time: String
    }

    private func keep() {
        guard let account, let data = try? JSONEncoder().encode(Kept(filters: filters, time: time)) else { return }
        UserDefaults.standard.set(data, forKey: Self.filtersKey(account))
    }

    private static func filtersKey(_ account: String) -> String {
        "pantopus.pulse.filters.\(account)"
    }

    private static func visitKey(_ account: String) -> String {
        "pantopus.pulse.visit.\(account)"
    }

    private static let iso: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

/// The Filters sheet from the bottom: What, When, From, State; Clear and Done.
struct ReinventedPulseFiltersSheet: View {
    let map: ReinventedMapModel
    let onDone: () -> Void
    private let store = ReinventedPulseFilterStore.shared
    @State private var picked = ReinventedPulseFilters.none
    @State private var time = "live"

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    group("What") {
                        chips(
                            "what",
                            ReinventedPulseFilters.kinds,
                            title: ReinventedPulseFilterStore.kindTitle,
                            on: picked.kinds.contains
                        ) { kind in
                            picked.kinds = flip(picked.kinds, kind)
                        }
                    }
                    group("When") {
                        chips(
                            "when",
                            ReinventedPulseFilterStore.whens.map(\.time),
                            title: whenTitle,
                            on: { $0 == time },
                            tap: { time = $0 }
                        )
                    }
                    group("From") {
                        chips(
                            "from",
                            ["everyone", "connections"],
                            title: { $0 == "everyone" ? "Everyone" : "Connections only" },
                            on: { $0 == picked.from },
                            tap: { picked.from = $0 }
                        )
                    }
                    group("State") {
                        toggle("Unanswered Asks", on: picked.state.contains("unanswered"), id: "unanswered") {
                            picked.state = flip(picked.state, "unanswered")
                        }
                        toggle("Plans with room", on: picked.state.contains("room"), id: "room") {
                            picked.state = flip(picked.state, "room")
                        }
                        toggle(
                            store.since == nil ? "New since your last visit (after your next visit)" : "New since your last visit",
                            on: picked.fresh,
                            id: "fresh"
                        ) { picked.fresh.toggle() }
                            .disabled(store.since == nil)
                    }
                    Text("Heads-ups always show, whatever is filtered.")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .padding(Spacing.s4)
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Clear") {
                        picked = .none
                        time = "live"
                    }
                    .accessibilityIdentifier("reinventedPulse.filters.clear")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        store.set(picked)
                        map.pick(time: time)
                        onDone()
                    }
                    .fontWeight(.semibold)
                    .accessibilityIdentifier("reinventedPulse.filters.done")
                }
            }
        }
        .onAppear {
            picked = store.filters
            // The sheet's When has four; This week and All time (from the time strip) read as Now here until changed.
            time = map.time
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("reinventedPulse.filters")
    }

    private func whenTitle(_ time: String) -> String {
        ReinventedPulseFilterStore.whens.first { $0.time == time }?.title ?? time
    }

    private func flip(_ list: [String], _ value: String) -> [String] {
        list.contains(value) ? list.filter { $0 != value } : list + [value]
    }

    private func group(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            content()
        }
    }

    private func chips(
        _ group: String,
        _ keys: [String],
        title: @escaping (String) -> String,
        on: @escaping (String) -> Bool,
        tap: @escaping (String) -> Void
    ) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(keys, id: \.self) { key in
                    let lit = on(key)
                    Button { tap(key) } label: {
                        Text(title(key))
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(lit ? Color.white : Theme.Color.appText)
                            .padding(.horizontal, Spacing.s3)
                            .frame(height: 28)
                            .background(Capsule().fill(lit ? Theme.Color.primarySolid : Theme.Color.appSurface))
                            .overlay(Capsule().stroke(lit ? Color.clear : Theme.Color.appBorder, lineWidth: 1))
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(lit ? [.isButton, .isSelected] : .isButton)
                    .accessibilityIdentifier("reinventedPulse.filters.\(group).\(key)")
                }
            }
        }
    }

    private func toggle(_ title: String, on: Bool, id: String, tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            HStack(spacing: Spacing.s2) {
                Icon(
                    on ? .checkCircle : .circle,
                    size: 18,
                    strokeWidth: 2.2,
                    color: on ? Theme.Color.primaryTint : Theme.Color.appTextSecondary
                )
                Text(title)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: 0)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("reinventedPulse.filters.\(id)")
    }
}
