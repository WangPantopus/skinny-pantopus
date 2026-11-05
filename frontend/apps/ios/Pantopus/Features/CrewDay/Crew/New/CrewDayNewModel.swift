//
//  CrewDayNewModel.swift
//  Pantopus
//
//  14. New Crew Day (build kit 01-spec.md, board `NewCrewDay`; phones use
//  the Wizard archetype): 1 service and what's included, 2 where and when,
//  3 prices, 4 review and send. `POST /api/crew-days` with `submit` true
//  (Send to Pantopus for approval) or false (Save draft).
//

import CoreLocation
import Foundation

/// One editable price row.
struct CrewDayNewOption: Identifiable, Hashable {
    let id: String
    var label: String
    /// Dollars as typed ("180").
    var price: String
    var needsLook: Bool

    var cents: Int? {
        guard !needsLook else { return nil }
        let trimmed = price.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "$", with: "")
        guard let dollars = Double(trimmed), dollars > 0 else { return nil }
        return Int((dollars * 100).rounded())
    }

    var isValid: Bool {
        !label.trimmingCharacters(in: .whitespaces).isEmpty && (needsLook || cents != nil)
    }
}

/// One editable add-on row.
struct CrewDayNewAddOn: Identifiable, Hashable {
    let id: String
    var label: String
    var price: String

    var cents: Int? {
        let trimmed = price.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "$", with: "")
        guard let dollars = Double(trimmed), dollars > 0 else { return nil }
        return Int((dollars * 100).rounded())
    }
}

/// How far the day reaches from its center.
enum CrewDayReach: Int, CaseIterable, Identifiable {
    case street = 150
    case blocks = 400
    case neighborhood = 800

    var id: Int {
        rawValue
    }

    var label: String {
        switch self {
        case .street: "Just this street"
        case .blocks: "A few blocks"
        case .neighborhood: "The neighborhood"
        }
    }

    var detail: String {
        "About \(rawValue) m"
    }
}

@Observable
@MainActor
final class CrewDayNewModel: WizardModel {
    enum Step: Int, CaseIterable {
        case service, whereWhen, prices, review
    }

    let businessId: String
    private let onClose: @MainActor () -> Void
    private(set) var step: Step = .service
    private(set) var isSubmitting = false
    var error: String?
    /// At the accessibility text sizes (the view sets it) Save draft ends the review instead of sitting in the
    /// footer, which would cover half the screen.
    var largeText = false
    /// Sent: the day's status (`pending_review` or `draft`).
    private(set) var sentStatus: String?
    private(set) var sentDayId: String?
    /// The business's fee, for the line on step 3.
    private(set) var feeRate: Double?
    private(set) var founding = false
    /// The server's included items per service, when it sends them.
    private(set) var presets: [CrewDayServicePresetDTO] = []
    /// "Offer a Crew Day here again": the day this one repeats.
    private(set) var repeatOf: String?

    // MARK: Step 1: the service and what's included

    var service: CrewDayService = .gutterCleaning {
        didSet { if service != oldValue { prefill(for: service) } }
    }

    var included: [String] = CrewDayNewDefaults.included(.gutterCleaning)
    var outsideOnly = true

    // MARK: Step 2: where and when

    var streetLabel = ""
    var centerQuery = ""
    private(set) var center: NormalizedAddress?
    var reach: CrewDayReach = .street
    var serviceDate = CrewDayNewDefaults.firstDay()
    var windowStart = CrewDayNewDefaults.time(hour: 9)
    var windowEnd = CrewDayNewDefaults.time(hour: 13)
    var capacity = 10
    var closesEarly = false
    var bookingClosesAt = Date()

    // MARK: Step 3: prices

    var options: [CrewDayNewOption] = CrewDayNewDefaults.options(.gutterCleaning)
    var addOns: [CrewDayNewAddOn] = CrewDayNewDefaults.addOns(.gutterCleaning)
    var prepNote = ""

    init(businessId: String, onClose: @escaping @MainActor () -> Void) {
        self.businessId = businessId
        self.onClose = onClose
        bookingClosesAt = defaultClose
    }

    /// The business's fee and the server's presets for each service.
    func loadFee() async {
        guard let response: CrewDayBusinessResponse = try? await APIClient.shared.request(
            CrewDayEndpoints.business(businessId: businessId)
        ) else { return }
        feeRate = response.fee?.ratePct.map { $0 / 100 }
        founding = response.fee?.founding ?? false
        presets = response.services
    }

    // MARK: - Address

    func useCenter(_ address: NormalizedAddress) {
        center = address
        centerQuery = address.address ?? centerQuery
        if streetLabel.trimmingCharacters(in: .whitespaces).isEmpty, let line = address.address {
            streetLabel = CrewDayNewDefaults.street(from: line)
        }
    }

    func clearCenter() {
        center = nil
    }

    // MARK: - Derived

    /// The arrival window's start as an instant in Pacific time (the server's default zone).
    var windowStartsAt: Date {
        CrewDayNewDefaults.combine(serviceDate, windowStart)
    }

    /// 48 hours before the window starts.
    var defaultClose: Date {
        windowStartsAt.addingTimeInterval(-48 * 3600)
    }

    var closesAt: Date {
        closesEarly ? bookingClosesAt : defaultClose
    }

    /// Booking stays open at least an hour from now and closes before the crew arrives (the server's rule).
    var closesInTime: Bool {
        closesAt > Date().addingTimeInterval(3600) && closesAt <= windowStartsAt
    }

    /// "Gutter Day on Maple Lane" (the server builds the same when none is given).
    var title: String {
        let street = streetLabel.trimmingCharacters(in: .whitespaces)
        return street.isEmpty ? CrewDayNewDefaults.dayName(service) : "\(CrewDayNewDefaults.dayName(service)) on \(street)"
    }

    var feeLine: String {
        guard let feeRate else {
            return "Pantopus keeps its fee from each charge. Money reaches your bank 48 hours after each charge."
        }
        let percent = Int((feeRate * 100).rounded())
        let why = founding ? " (founding business)" : ""
        return "Pantopus keeps \(percent)% of each charge\(why). Money reaches your bank 48 hours after each charge."
    }

    var stepIsValid: Bool {
        switch step {
        case .service:
            !included.allSatisfy { $0.trimmingCharacters(in: .whitespaces).isEmpty }
        case .whereWhen:
            !streetLabel.trimmingCharacters(in: .whitespaces).isEmpty && center?.latitude != nil
                && windowEnd > windowStart && (1...60).contains(capacity)
                && closesInTime
        case .prices:
            !options.isEmpty && options.allSatisfy(\.isValid)
                && addOns.allSatisfy { $0.label.trimmingCharacters(in: .whitespaces).isEmpty || $0.cents != nil }
        case .review:
            true
        }
    }

    // MARK: - WizardModel

    var chrome: WizardChrome {
        WizardChrome(
            title: "New Crew Day",
            progressLabel: .stepOf(current: step.rawValue + 1, total: Step.allCases.count),
            progressFraction: Double(step.rawValue + 1) / Double(Step.allCases.count),
            leading: step == .service ? .close : .back,
            primaryCTALabel: step == .review ? "Send to Pantopus for approval" : "Continue",
            primaryCTAEnabled: stepIsValid && !isSubmitting,
            primaryCTAIdentifier: step == .review ? "crewDayNewSend" : "crewDayNewContinue",
            secondaryCTA: step == .review && !largeText
                ? WizardSecondaryCTA(label: "Save draft", identifier: "crewDayNewSaveDraft")
                : nil,
            isSubmitting: isSubmitting,
            footerHint: nil,
            dirty: true,
            showsProgressBar: true
        )
    }

    func leadingTapped() {
        guard let previous = Step(rawValue: step.rawValue - 1) else { return }
        error = nil
        step = previous
    }

    func discardConfirmed() {
        onClose()
    }

    func primaryTapped() {
        error = nil
        if let next = Step(rawValue: step.rawValue + 1) {
            step = next
        } else {
            Task { await send(submit: true) }
        }
    }

    func secondaryTapped() {
        Task { await send(submit: false) }
    }

    // MARK: - Send

    private func send(submit: Bool) async {
        guard let center, let latitude = center.latitude, let longitude = center.longitude else { return }
        isSubmitting = true
        defer { isSubmitting = false }
        let body = CrewDayCreateBody(
            businessId: businessId,
            service: service.rawValue,
            streetLabel: streetLabel.trimmingCharacters(in: .whitespaces),
            city: center.city ?? "",
            state: center.state ?? "",
            center: CrewDayPoint(latitude: latitude, longitude: longitude),
            radiusM: reach.rawValue,
            serviceDate: CrewDayNewDefaults.dayString(serviceDate),
            windowStart: CrewDayNewDefaults.timeString(windowStart),
            windowEnd: CrewDayNewDefaults.timeString(windowEnd),
            capacity: capacity,
            bookingClosesAt: closesEarly ? CrewDayFormat.iso(bookingClosesAt) : nil,
            included: included.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty },
            outsideOnly: outsideOnly,
            prepNote: prepNote.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : prepNote,
            priceOptions: options.map {
                CrewDayPriceOption(
                    id: $0.id,
                    label: $0.label.trimmingCharacters(in: .whitespaces),
                    priceCents: $0.cents,
                    needsLook: $0.needsLook
                )
            },
            addOns: addOns.compactMap { row in
                let label = row.label.trimmingCharacters(in: .whitespaces)
                guard !label.isEmpty, let cents = row.cents else { return nil }
                return CrewDayAddOn(id: row.id, label: label, priceCents: cents)
            },
            submit: submit,
            repeatOf: repeatOf
        )
        do {
            let response: CrewDayWriteResponse = try await APIClient.shared.request(CrewDayEndpoints.create(body))
            sentDayId = response.crewDay.id
            sentStatus = response.crewDay.card.status
        } catch {
            self.error = CrewDayErrors.sentence(for: error)
        }
    }

    /// Every step from a day the crew ran before (the date is still the crew's to pick).
    func prefill(from page: CrewDayCrewPageDTO) {
        let day = page.day
        repeatOf = day.id
        if let service = CrewDayService(rawValue: day.card.service ?? "") { self.service = service }
        if !day.included.isEmpty { included = Array(day.included.prefix(6)) }
        outsideOnly = day.outsideOnly
        streetLabel = day.card.streetLabel ?? streetLabel
        if let point = day.center {
            center = NormalizedAddress(
                address: "Near \(streetLabel)",
                city: day.card.city,
                state: day.card.state,
                zipcode: nil,
                latitude: point.latitude,
                longitude: point.longitude,
                placeId: nil,
                verified: nil,
                source: nil
            )
            centerQuery = "The same area as \(day.card.title)"
        }
        if let radius = day.radiusM, let match = CrewDayReach(rawValue: radius) { reach = match }
        capacity = max(1, day.card.capacity)
        if !day.priceOptions.isEmpty {
            options = day.priceOptions.map {
                CrewDayNewOption(id: $0.id, label: $0.label, price: $0.priceCents.map { String($0 / 100) } ?? "", needsLook: $0.needsLook)
            }
        }
        addOns = day.addOns.map { CrewDayNewAddOn(id: $0.id, label: $0.label, price: String($0.priceCents / 100)) }
        prepNote = day.prepNote ?? ""
    }

    private func prefill(for service: CrewDayService) {
        let preset = presets.first { $0.key == service.rawValue }?.included ?? []
        included = preset.isEmpty ? CrewDayNewDefaults.included(service) : Array(preset.prefix(6))
        options = CrewDayNewDefaults.options(service)
        addOns = CrewDayNewDefaults.addOns(service)
    }
}
