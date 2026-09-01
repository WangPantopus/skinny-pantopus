//
//  InviteeReviewConfirmViewModel.swift
//  Pantopus
//
//  D2 Review & Confirm / Checkout (Stream I6). The final summary before commit.
//  Reads the D1 draft from the in-session draft store, renders who/what/when/
//  where (+ the price block when priced and the paid flag is on), and commits
//  the booking via `POST /api/public/book/:slug/:eventTypeSlug`.
//
//  On success it routes to D3 (Confirmed), which carries the one-time
//  `manageToken` in its route. A 409 surfaces the Foundation `SlotTakenSheet`
//  with the backend's nearest open times — never a dead end. Paid surfaces stay
//  behind `SchedulingFeatureFlags.paidEnabled` + Stripe TEST mode (settlement is
//  deferred server-side → D3 shows a processing/pending receipt).
//

import SwiftUI

@Observable
@MainActor
final class InviteeReviewConfirmViewModel {
    enum State: Equatable {
        case loading
        case ready
        case confirming
        case error(message: String)
    }

    // Route payload
    let slug: String
    let eventTypeSlug: String
    let tz: String

    private(set) var bookingStart: String

    private let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    private(set) var state: State = .loading
    private(set) var eventType: PublicEventTypeView?
    private(set) var page: PublicPageView?
    private(set) var draft = InviteeBookingDraft()

    // Transient (over .ready)
    var showSlotTakenSheet = false
    private(set) var slotTakenAlternatives: [SchedulingSlotAlternative] = []
    private(set) var slotTakenActive = false
    private(set) var inlineBanner: InlineBanner?
    var showPolicySheet = false

    /// A transient inline banner shown above the summary.
    struct InlineBanner {
        let tone: ConfirmBanner.Tone
        let icon: PantopusIcon
        let title: String
        let message: String?
    }

    private var didLoad = false

    init(
        slug: String,
        eventTypeSlug: String,
        start: String,
        tz: String,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.slug = slug
        self.eventTypeSlug = eventTypeSlug
        bookingStart = start
        self.tz = tz
        self.push = push
        self.client = client
    }

    // MARK: - Derived presentation

    var accent: Color {
        DiscoveryTheme.accent(forOwnerType: page?.ownerType)
    }

    var avatarColors: [Color] {
        DiscoveryTheme.avatarColors(forOwnerType: page?.ownerType)
    }

    /// Paid surfaces only appear when the event is priced AND the flag is on.
    var showsPaidSurfaces: Bool {
        (eventType?.isPriced ?? false) && SchedulingFeatureFlags.paidEnabled
    }

    var isDeposit: Bool {
        guard let event = eventType else { return false }
        return (event.depositCents ?? 0) > 0 && (event.depositCents ?? 0) < (event.priceCents ?? 0)
    }

    /// A single itemized row in the totals box (mirrors the JSX `TotalsBox` rows).
    struct PriceRow: Hashable {
        let label: String
        let amount: String
        var strong: Bool = false
        var credit: Bool = false
    }

    /// The itemized fee rows shown above the Total. Only the priced event line is
    /// drivable from the model — a discrete service-fee/tax/credit breakdown isn't
    /// exposed by `PublicEventTypeView`, so those JSX rows are intentionally
    /// deferred (see `deferredBackend`).
    var priceRows: [PriceRow] {
        guard let event = eventType else { return [] }
        let label = "\(event.name) · \(event.bookingDuration) min"
        return [PriceRow(label: label, amount: ConfirmFormat.money(cents: event.priceCents ?? 0, currency: event.currency), strong: true)]
    }

    /// Whether any credit row is present in `priceRows` — gates the `CreditChip`
    /// (Frame 4) and the "Credit applied · use a different one" label on
    /// `ApplyCreditRow`. Always `false` until the backend exposes credit data.
    var hasCreditApplied: Bool {
        priceRows.contains { $0.credit }
    }

    /// The deposit amount rendered (bold) in the deposit note + due-now hero.
    var depositAmountLabel: String {
        ConfirmFormat.money(cents: eventType?.depositCents ?? 0, currency: eventType?.currency)
    }

    var summary: BookingSummary {
        let duration = eventType?.bookingDuration ?? 30
        let endAtISO = SchedulingTime.parseUTC(bookingStart).map { endISO(for: $0, durationMin: duration) }
        let location = DiscoveryLocation.label(mode: eventType?.locationMode, detail: eventType?.locationDetail)
        let guests = draft.guests
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        return BookingSummary(
            initials: ConfirmFormat.initials(from: page?.title),
            avatarColors: avatarColors,
            accent: accent,
            eventName: eventType?.name ?? "Booking",
            hostName: page?.title,
            pillarTitle: ConfirmPillar.title(forOwnerType: page?.ownerType),
            dateLine: ConfirmFormat.dayAndTime(startUTC: bookingStart, endUTC: endAtISO, tz: tz),
            tzLabel: ConfirmFormat.tzChipLabel(tz: tz),
            locationTitle: location ?? "Details to follow",
            locationSub: location == nil ? nil : "Join details are sent after you book.",
            attendeePrimary: "\(draft.fullName) (you)",
            attendeeSecondary: guests.isEmpty ? nil : "+ \(guests.joined(separator: ", "))",
            answers: answerPairs()
        )
    }

    var ctaLabel: String {
        guard showsPaidSurfaces, let cents = chargeCents else { return "Confirm booking" }
        return "Pay \(ConfirmFormat.money(cents: cents, currency: eventType?.currency)) & book"
    }

    var ctaIcon: PantopusIcon {
        showsPaidSurfaces ? .lock : .check
    }

    /// The amount charged now (deposit when applicable, else the full price).
    var chargeCents: Int? {
        guard let event = eventType, event.isPriced else { return nil }
        if isDeposit { return event.depositCents }
        return event.priceCents
    }

    var refundSummary: String {
        if let window = eventType?.cancellationWindowMin, window > 0 {
            let hours = max(1, window / 60)
            return "Free cancellation up to \(hours)h before."
        }
        return "Review the host's cancellation policy."
    }

    var policyDisplay: CancellationPolicyDisplay {
        let windowHours = (eventType?.cancellationWindowMin).map { max(1, $0 / 60) }
        return CancellationPolicyDisplay(
            name: eventType?.name,
            freeCancellationWindow: windowHours.map { "Up to \($0)h before the start time" },
            refundAfterCutoff: refundCopy(for: eventType?.refundPolicy),
            depositNonRefundable: (eventType?.depositRefundable == false) && (eventType?.depositCents ?? 0) > 0,
            rescheduleCutoff: (eventType?.rescheduleCutoffMin).map { "Up to \(max(1, $0 / 60))h before" }
        )
    }

    // MARK: - Loading

    func load() async {
        guard !didLoad else { return }
        didLoad = true
        if let context = InviteeBookingDraftStore.shared.context(slug: slug, eventTypeSlug: eventTypeSlug, start: bookingStart) {
            eventType = context.eventType
            page = context.page
            draft = context.draft
            state = .ready
        } else {
            await fetchContext()
        }
    }

    /// Degraded deep-link entry (no draft) — fetch the event type so the summary
    /// still renders; the booker is sent back to D1 to enter their details.
    private func fetchContext() async {
        state = .loading
        do {
            let view: PublicBookView = try await client.request(SchedulingPublicEndpoints.bookPage(slug: slug))
            page = view.page
            eventType = view.eventTypes.first { $0.slug == eventTypeSlug }
            if eventType == nil {
                state = .error(message: "This booking type isn't available")
            } else {
                state = .ready
            }
        } catch let error as SchedulingError {
            state = .error(message: error.userMessage ?? "Something went wrong. Try again.")
        } catch {
            state = .error(message: "Something went wrong. Try again.")
        }
    }

    func refresh() async {
        didLoad = false
        await load()
    }

    var needsDetails: Bool {
        draft.fullName.isEmpty || draft.email.isEmpty
    }

    // MARK: - Confirm

    func confirm() async {
        guard let event = eventType, !needsDetails else { return }
        inlineBanner = nil
        slotTakenActive = false
        state = .confirming
        let request = PublicBookingCreateRequest(
            startAt: bookingStart,
            name: draft.fullName,
            email: draft.email,
            durationMin: event.bookingDuration,
            phone: draft.phone(forPhoneQuestionId: phoneQuestionKey()),
            timezone: tz,
            answers: draft.answersJSON()
        )
        do {
            let response: PublicBookingCreateResponse = try await client.request(
                SchedulingPublicEndpoints.createBooking(slug: slug, eventTypeSlug: eventTypeSlug, request)
            )
            InviteeBookingDraftStore.shared.clear(slug: slug, eventTypeSlug: eventTypeSlug, start: bookingStart)
            // Restore .ready BEFORE pushing D3: its Done/X pops back onto this
            // screen, which otherwise stays frozen in the .confirming shimmer.
            state = .ready
            // Paid path: settlement is deferred server-side (Stripe TEST). The
            // booking is created; D3 reflects the processing/pending receipt.
            push(.inviteeConfirmed(manageToken: response.manageToken))
        } catch let error as SchedulingError {
            handle(error)
        } catch {
            state = .ready
            inlineBanner = InlineBanner(
                tone: .error,
                icon: .alertTriangle,
                title: "Couldn't confirm your booking",
                message: "Something went wrong. Your time is still held — try again."
            )
        }
    }

    private func handle(_ error: SchedulingError) {
        state = .ready
        switch error {
        case let .slotConflict(_, _, alternatives):
            slotTakenAlternatives = alternatives
            slotTakenActive = true
        case let .conflict(code, message):
            if code == "PAGE_PAUSED" {
                inlineBanner = InlineBanner(
                    tone: .warning,
                    icon: .pause,
                    title: "This page paused bookings",
                    message: message ?? "The host isn't accepting bookings right now."
                )
            } else {
                inlineBanner = InlineBanner(
                    tone: .warning,
                    icon: .alertTriangle,
                    title: "Couldn't confirm your booking",
                    message: message
                )
            }
        case let .validation(message, _):
            inlineBanner = InlineBanner(
                tone: .error,
                icon: .alertCircle,
                title: "Check your details",
                message: message ?? "Some required details are missing."
            )
        default:
            inlineBanner = InlineBanner(
                tone: .error,
                icon: .alertTriangle,
                title: "Couldn't confirm your booking",
                message: error.userMessage
            )
        }
    }

    // MARK: - Slot-taken recovery

    func presentSlotTaken() {
        showSlotTakenSheet = true
    }

    /// "Pick another time" from the slot-taken sheet. Records the conflicted
    /// slot on the relay so the unwind continues past D1 back onto the C6
    /// picker (which shows the Frame 6 taken treatment); the view follows this
    /// with `dismiss()`.
    func pickAnotherTime() {
        showSlotTakenSheet = false
        SlotTakenRelay.shared.signal(slug: slug, eventTypeSlug: eventTypeSlug, start: bookingStart)
    }

    func selectAlternative(_ alternative: SchedulingSlotAlternative) async {
        bookingStart = alternative.start
        showSlotTakenSheet = false
        slotTakenActive = false
        await confirm()
    }

    var slotTakenLabel: String? {
        ConfirmFormat.dayAndTime(startUTC: bookingStart, endUTC: nil, tz: tz)
    }

    /// The slot-taken banner body, interpolating the just-taken time when known
    /// (JSX: "Someone booked Wed, Jun 17 at 9:30 AM before you finished…").
    var slotTakenBannerBody: String {
        if let when = slotTakenLabel {
            return "Someone booked \(when) before you finished. Nothing was charged."
        }
        return "Someone booked it before you finished. Nothing was charged."
    }

    // MARK: - Helpers

    private func answerPairs() -> [(question: String, answer: String)] {
        let questions = (eventType?.questions ?? []).sorted { ($0.sortOrder ?? 0) < ($1.sortOrder ?? 0) }
        return questions.compactMap { question -> (String, String)? in
            let key = question.id ?? question.label
            guard let value = draft.answers[key], value.isAnswered else { return nil }
            switch value {
            case let .text(text): return (question.label, text)
            case let .choices(values): return (question.label, values.joined(separator: ", "))
            case let .flag(flag): return (question.label, flag ? "Yes" : "No")
            }
        }
    }

    private func phoneQuestionKey() -> String? {
        guard let phone = (eventType?.questions ?? []).first(where: { ($0.fieldType ?? "").lowercased() == "phone" }) else {
            return nil
        }
        return phone.id ?? phone.label
    }

    private func refundCopy(for policy: String?) -> String? {
        switch (policy ?? "").lowercased() {
        case "full": "Full refund before the cutoff"
        case "partial": "Partial refund before the cutoff"
        case "none": "Non-refundable after booking"
        case "deposit_only": "Deposit is non-refundable"
        default: nil
        }
    }

    private func endISO(for start: Date, durationMin: Int) -> String {
        let end = start.addingTimeInterval(TimeInterval(durationMin * 60))
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: end)
    }
}

#if DEBUG
extension InviteeReviewConfirmViewModel {
    static func previewFree() -> InviteeReviewConfirmViewModel {
        make(priceCents: nil)
    }

    static func previewPaid() -> InviteeReviewConfirmViewModel {
        SchedulingFeatureFlags.paidEnabled = true
        return make(priceCents: 4800)
    }

    private static func make(priceCents: Int?) -> InviteeReviewConfirmViewModel {
        let viewModel = InviteeReviewConfirmViewModel(
            slug: "ada",
            eventTypeSlug: "intro",
            start: "2026-06-17T16:30:00Z",
            tz: "America/Los_Angeles",
            push: { _ in },
            client: .shared
        )
        let priceJSON = priceCents.map { ", \"price_cents\": \($0), \"currency\": \"usd\"" } ?? ""
        let json = """
        {"page":{"slug":"ada","title":"Maria Kessler","owner_type":"user"},
        "status":"active",
        "eventTypes":[{"id":"et1","name":"Intro call","slug":"intro",
        "default_duration":30,"location_mode":"video",
        "cancellation_window_min":1440\(priceJSON)}]}
        """
        if let data = json.data(using: .utf8), let view = try? JSONDecoder().decode(PublicBookView.self, from: data) {
            viewModel.page = view.page
            viewModel.eventType = view.eventTypes.first
        }
        viewModel.draft = InviteeBookingDraft(firstName: "Maya", lastName: "Chen", email: "maya.chen@gmail.com")
        viewModel.state = .ready
        return viewModel
    }
}
#endif
