//
//  FirstRunWizardModel.swift
//  Pantopus
//
//  A2 "Set up booking" first-run wizard view-model. Four steps: claim link ·
//  pick type · weekly hours · success. Backend wiring: debounced check-slug,
//  PUT booking-page/slug (re-checking on SLUG_TAKEN to surface suggestions),
//  POST a starter event type, and PUT booking-page timezone to seed the page.
//  Availability rule writes are another stream's domain — A2 only seeds the page
//  timezone and shows the default hours. Conforms `WizardModel` for `WizardShell`.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class FirstRunWizardModel: WizardModel {
    enum Step: Int, CaseIterable { case link = 1, type, hours, success }

    // Public step state (the screen switches on this).
    private(set) var step: Step = .link
    private(set) var isFinished = false
    var pendingShareURL: URL?

    /// Resume state — true when the wizard was opened with steps 1–2 already
    /// complete (i.e. starting at step 3). The screen shows a ResumeBanner.
    private(set) var isResuming = false

    /// Step 1 — handle.
    var slug: String = "" {
        didSet {
            // Keep typed input inside the backend's slug charset (lowercase letters, digits,
            // hyphens) — anything else 400s INVALID_SLUG server-side and previously
            // dead-ended the checker with no feedback. Android filters keystrokes the same
            // way. (Assigning inside didSet replaces the value without re-firing.)
            let cleaned = String(slug.lowercased().filter { "abcdefghijklmnopqrstuvwxyz0123456789-".contains($0) })
            if cleaned != slug { slug = cleaned }
            if slug != oldValue { onSlugEdited() }
        }
    }

    private(set) var slugState: SlugFieldState = .idle

    // Step 2 — type.
    var locationMode: String = "video"
    var duration: Int = 30

    /// Step 3 — hours (default Mon–Fri on).
    var hoursEnabled: [Int: Bool] = [1: true, 2: true, 3: true, 4: true, 5: true, 6: false, 0: false]

    /// Submission flags.
    private(set) var isSubmitting = false

    let owner: SchedulingOwner
    private let client = SchedulingClient.shared
    private let api = APIClient.shared

    let timezoneIdentifier: String
    private var slugCheckTask: Task<Void, Never>?
    private var seededTimezone = false

    var theme: SchedulingIdentityTheme {
        owner.theme
    }

    /// - Parameters:
    ///   - owner: The scheduling owner pillar (Personal / Home / Business).
    ///   - resuming: Pass `true` when re-entering the wizard with steps 1–2
    ///     already done (i.e. a booking page + slug exist). The wizard opens
    ///     directly at step 3 and shows a resume banner. Defaults to `false`.
    init(owner: SchedulingOwner, resuming: Bool = false) {
        self.owner = owner
        timezoneIdentifier = SchedulingTime.deviceTimeZoneIdentifier
        if resuming {
            step = .hours
            isResuming = true
        }
        // Seed a suggested slug from the device but leave check idle until edited.
    }

    // MARK: Derived

    var rangeLabel: String {
        "9:00 AM – 5:00 PM"
    }

    var shareLink: String {
        slug.isEmpty ? "pantopus.com/book/…" : "pantopus.com/book/\(slug)"
    }

    private var step1Ready: Bool {
        if case .available = slugState { return true }
        return false
    }

    // MARK: WizardModel chrome

    var chrome: WizardChrome {
        switch step {
        case .link:
            WizardChrome(
                title: "Set up booking",
                progressLabel: .stepOf(current: 1, total: 4),
                progressFraction: 0.25,
                // Design step-1 chrome is a plain back chevron that exits the
                // wizard (no discard sheet) — `.back` routes to leadingTapped()
                // which finishes on `.link`.
                leading: .back,
                primaryCTALabel: "Continue · pick a type",
                primaryCTAEnabled: step1Ready,
                primaryCTAIdentifier: "firstRunWizardPrimary",
                isSubmitting: isSubmitting,
                dirty: !slug.isEmpty,
                showsProgressBar: false
            )
        case .type:
            WizardChrome(
                title: "Set up booking",
                progressLabel: .stepOf(current: 2, total: 4),
                progressFraction: 0.5,
                leading: .back,
                primaryCTALabel: "Continue",
                primaryCTAEnabled: true,
                primaryCTAIdentifier: "firstRunWizardPrimary",
                isSubmitting: isSubmitting,
                dirty: true,
                showsProgressBar: false
            )
        case .hours:
            WizardChrome(
                title: "Set up booking",
                progressLabel: .stepOf(current: 3, total: 4),
                progressFraction: 0.75,
                leading: .back,
                primaryCTALabel: "Continue",
                primaryCTAEnabled: true,
                primaryCTAIdentifier: "firstRunWizardPrimary",
                secondaryCTA: WizardSecondaryCTA(label: "Use defaults", identifier: "firstRunWizardDefaults"),
                isSubmitting: isSubmitting,
                dirty: true,
                showsProgressBar: false
            )
        case .success:
            WizardChrome(
                title: "Set up booking",
                progressLabel: .stepOf(current: 4, total: 4),
                progressFraction: 1,
                leading: .back,
                primaryCTALabel: "Share link",
                primaryCTAEnabled: true,
                primaryCTAIdentifier: "firstRunWizardShare",
                secondaryCTA: WizardSecondaryCTA(label: "Add type", identifier: "firstRunWizardAddType", icon: .plus),
                isSubmitting: false,
                dirty: false,
                showsProgressBar: false
            )
        }
    }

    func leadingTapped() {
        switch step {
        case .link:
            isFinished = true
        case .type:
            step = .link
        case .hours:
            step = .type
        case .success:
            step = .hours
        }
    }

    func discardConfirmed() {
        isFinished = true
    }

    func primaryTapped() {
        guard !isSubmitting else { return }
        switch step {
        case .link:
            Task { await claimSlug() }
        case .type:
            Task { await createStarterType() }
        case .hours:
            Task { await seedTimezoneAndAdvance() }
        case .success:
            shareFromSuccess()
        }
    }

    func secondaryTapped() {
        switch step {
        case .hours:
            // "Use defaults" — same as continue (defaults already applied).
            Task { await seedTimezoneAndAdvance() }
        case .success:
            // "Add type" — finish and let the hub route to the editor.
            isFinished = true
        default:
            break
        }
    }

    func finishAfterShare() {
        isFinished = true
    }

    // MARK: Slug check (debounced)

    func pickSuggestion(_ s: String) {
        slug = s
    }

    private func onSlugEdited() {
        slugCheckTask?.cancel()
        let candidate = slug.trimmingCharacters(in: .whitespaces)
        guard !candidate.isEmpty else { slugState = .idle
            return
        }
        slugState = .checking
        slugCheckTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 450_000_000)
            guard !Task.isCancelled else { return }
            await self?.runSlugCheck(candidate)
        }
    }

    private func runSlugCheck(_ candidate: String) async {
        guard candidate == slug.trimmingCharacters(in: .whitespaces) else { return }
        do {
            let result: CheckSlugResponse = try await client.request(SchedulingEndpoints.checkSlug(owner: owner, slug: candidate))
            guard candidate == slug.trimmingCharacters(in: .whitespaces) else { return }
            if result.available {
                slugState = .available
            } else {
                slugState = .taken(suggestions: result.suggestions ?? [])
            }
        } catch {
            guard candidate == slug.trimmingCharacters(in: .whitespaces) else { return }
            // On a check failure, treat as idle so the user can still try Continue
            // (the slug PUT will surface the authoritative error).
            slugState = .idle
        }
    }

    // MARK: Step 1 — claim slug

    private func claimSlug() async {
        let candidate = slug.trimmingCharacters(in: .whitespaces)
        guard !candidate.isEmpty else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            _ = try await client.request(SchedulingEndpoints.updateBookingPageSlug(
                owner: owner,
                BookingPageSlugRequest(slug: candidate)
            )) as BookingPageResponse
            step = .type
        } catch let error as SchedulingError {
            if error.code == "SLUG_TAKEN" {
                await runSlugCheck(candidate) // surface suggestions
            } else {
                // Not a taken slug — saying "taken" here sent people hunting for a new
                // handle when the real problem was the request itself.
                slugState = .error(message: error.userMessage ?? "Couldn't save the link. Try again.")
            }
        } catch {
            slugState = .error(message: "Couldn't save the link. Check your connection and try again.")
        }
    }

    // MARK: Step 2 — starter event type

    private func createStarterType() async {
        isSubmitting = true
        defer { isSubmitting = false }
        let name = "\(duration)-minute meeting"
        var attempt = 0
        while attempt < 4 {
            let suffix = attempt == 0 ? "" : "-\(attempt + 1)"
            let etSlug = "\(duration)min-meeting\(suffix)"
            let request = CreateEventTypeRequest(
                name: name,
                slug: etSlug,
                durations: [duration],
                defaultDuration: duration,
                locationMode: locationMode,
                assignmentMode: "one_on_one"
            )
            do {
                _ = try await client.request(SchedulingEndpoints.createEventType(owner: owner, request)) as EventTypeResponse
                step = .hours
                return
            } catch let error as SchedulingError {
                if error.code == "SLUG_TAKEN" { attempt += 1
                    continue
                }
                // Non-slug failures: advance anyway (slug is already claimed; the
                // hub will reflect whatever exists). Surface nothing blocking.
                step = .hours
                return
            } catch {
                step = .hours
                return
            }
        }
        // Exhausted retries — still advance.
        step = .hours
    }

    // MARK: Step 3 — seed timezone, then success

    private func seedTimezoneAndAdvance() async {
        isSubmitting = true
        defer { isSubmitting = false }
        if !seededTimezone {
            // Also publishes: pages insert with is_live=false, and the success step this
            // advances to invites the user to share a link that 404s while unpublished.
            _ = try? await client.request(SchedulingEndpoints.updateBookingPage(
                owner: owner,
                BookingPageUpdateRequest(timezone: timezoneIdentifier, isLive: true, isPaused: false)
            )) as BookingPageResponse
            // Persist the hours grid to the default schedule. Without this the step is
            // decorative: the server seeds Mon–Fri 09-17 in America/New_York, so any day the
            // user toggled — and their real timezone — never reached availability.
            if let availability = try? await client.request(SchedulingEndpoints.getAvailability()) as AvailabilityResponse,
               let schedule = availability.schedules.first(where: { $0.isDefault == true }) ?? availability.schedules.first {
                _ = try? await client.request(SchedulingEndpoints.updateSchedule(
                    id: schedule.id,
                    UpdateScheduleRequest(timezone: timezoneIdentifier)
                )) as AvailabilityScheduleResponse
                let rules = hoursEnabled.filter(\.value).keys.sorted().map {
                    RulesRequest.Rule(weekday: $0, startTime: "09:00", endTime: "17:00")
                }
                _ = try? await client.request(SchedulingEndpoints.setRules(
                    scheduleId: schedule.id,
                    RulesRequest(rules: rules)
                )) as RulesResponse
            }
            seededTimezone = true
        }
        step = .success
    }

    // MARK: Step 4 — share

    private func shareFromSuccess() {
        pendingShareURL = URL(string: "https://pantopus.com/book/\(slug)")
    }
}
