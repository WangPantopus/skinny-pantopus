//
//  MyHouseholdAvailabilityViewModel.swift
//  Pantopus
//
//  Stream I10 — F8 My Household Availability Settings.
//
//  A boundary screen that governs EXPOSURE only — it never edits the source
//  availability. The source of truth is the member's Personal availability
//  schedule (`GET /api/scheduling/availability`); this screen reads it only to
//  tell whether it's set up yet, and deep-links into it to edit.
//
//  The exposure toggles (share free/busy, round-robin, auto-decline) have no
//  server endpoint in migrations 159–165, so they persist as per-home device
//  preferences. Server-side household exposure sync is a backend gap to fill
//  later; this VM is structured so wiring it is a drop-in replacement for the
//  local-store calls.
//

import Foundation
import Observation

@Observable
@MainActor
final class MyHouseholdAvailabilityViewModel {
    enum Phase: Equatable {
        case loading
        case ready
        case error(message: String)
    }

    /// Which exposure row the household sees.
    enum Exposure: String, CaseIterable, Hashable {
        case shareFreeBusy
        case roundRobin
        case autoDecline
    }

    // MARK: - Observed state

    private(set) var phase: Phase = .loading
    /// Whether the member has set up their Personal availability yet. When
    /// false the exposure toggles are disabled and the "set it up" CTA shows.
    private(set) var personalIsSetUp = false
    private(set) var homeName = "This household"

    /// Exposure toggle values (device-local — see file header).
    private(set) var shareFreeBusy = true
    private(set) var roundRobin = true
    private(set) var autoDecline = false
    /// Static disclosure value for MVP — quiet-hours editing is a v2 surface.
    let quietHoursLabel = "Weeknights 9 PM"

    /// The exposure row currently persisting (renders an inline spinner).
    private(set) var savingExposure: Exposure?

    // MARK: - Dependencies

    private let homeId: String
    private let api: APIClient
    private let push: @MainActor (SchedulingRoute) -> Void
    private let defaults: UserDefaults

    init(
        homeId: String,
        api: APIClient = .shared,
        push: @escaping @MainActor (SchedulingRoute) -> Void = { _ in },
        defaults: UserDefaults = .standard
    ) {
        self.homeId = homeId
        self.api = api
        self.push = push
        self.defaults = defaults
        shareFreeBusy = storedBool(.shareFreeBusy, default: true)
        roundRobin = storedBool(.roundRobin, default: true)
        autoDecline = storedBool(.autoDecline, default: false)
    }

    // MARK: - Lifecycle

    func load() async {
        phase = .loading
        do {
            async let availabilityTask: AvailabilityResponse =
                api.request(SchedulingEndpoints.getAvailability())
            async let homeTask: HomeDetailResponse =
                api.request(HomesEndpoints.detail(homeId: homeId))

            let availability = try await availabilityTask
            personalIsSetUp = !availability.schedules.isEmpty

            // Home name is a nicety for the context header — don't fail the
            // screen if it can't be fetched.
            if let homeDetail = try? await homeTask,
               let resolved = homeDetail.home.base.name?.trimmingCharacters(in: .whitespaces),
               !resolved.isEmpty {
                homeName = resolved
            }
            phase = .ready
        } catch {
            phase = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load your availability settings."
            )
        }
    }

    // MARK: - Navigation

    /// Deep-link to the Personal availability source of truth (B4).
    func openPersonalSource() {
        push(.availabilityScheduleList)
    }

    /// Navigate to the household quiet-hours editor. The destination route is a
    /// v2 surface (not yet in SchedulingRoute), so this is a stub for now — the
    /// row is tappable per design (cursor:'pointer') and will route when F8b ships.
    func openQuietHours() {
        // No-op until the quiet-hours editor route is added to SchedulingRoute.
    }

    // MARK: - Exposure toggles

    func value(for exposure: Exposure) -> Bool {
        switch exposure {
        case .shareFreeBusy: shareFreeBusy
        case .roundRobin: roundRobin
        case .autoDecline: autoDecline
        }
    }

    /// Persist a toggle. Turning OFF `shareFreeBusy` is gated behind a confirm
    /// in the view, which calls this only after the user accepts.
    func setExposure(_ exposure: Exposure, to newValue: Bool) async {
        guard personalIsSetUp else { return }
        savingExposure = exposure
        switch exposure {
        case .shareFreeBusy: shareFreeBusy = newValue
        case .roundRobin: roundRobin = newValue
        case .autoDecline: autoDecline = newValue
        }
        store(exposure, value: newValue)
        // Reflect the design's per-row "saving" affordance. When the backend
        // gains a household-exposure endpoint this becomes the network call.
        try? await Task.sleep(nanoseconds: 350_000_000)
        savingExposure = nil
    }

    // MARK: - Local store

    private func key(for exposure: Exposure) -> String {
        "scheduling.household.\(homeId).\(exposure.rawValue)"
    }

    private func storedBool(_ exposure: Exposure, default defaultValue: Bool) -> Bool {
        let k = key(for: exposure)
        guard defaults.object(forKey: k) != nil else { return defaultValue }
        return defaults.bool(forKey: k)
    }

    private func store(_ exposure: Exposure, value: Bool) {
        defaults.set(value, forKey: key(for: exposure))
    }
}
