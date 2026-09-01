//
//  PlaceRealRentSection.swift
//  Pantopus
//
//  Wave 3 — the Real Rent benchmark on the Money detail.
//
//  This is NOT the `rent_band` card above it. That one is HUD's Fair
//  Market Rent: a 40th-percentile estimate for an entire COUNTY. This
//  one is real monthly rents reported by verified residents of THIS
//  block — the number no listings site can produce, because nobody
//  else can prove their reporters live here. The copy must never let
//  the two read as the same thing.
//
//  Band D: locked below T4, to read and to contribute alike. The
//  `building` state is the product, not an empty state — a true
//  statement of the block's progress toward its own benchmark.
//  Parity: Android PlaceRealRentContent.
//

import SwiftUI

// swiftlint:disable line_length

// MARK: - VM (the resident's own contribution)

@Observable
@MainActor
final class PlaceRealRentViewModel {
    enum State {
        case loading
        case none
        case loaded(RentReport)
        case error(message: String)
    }

    private(set) var state: State = .loading
    private(set) var isSaving = false
    /// Save failures stay INLINE and keep the typed amount. Replacing
    /// the whole form with a dead-end error card turns a one-character
    /// typo into an apparent outage — the bug just fixed in the rate
    /// watch, not to be reintroduced here.
    private(set) var saveError: String?
    var rentInput = ""
    var bedroomsInput = ""
    var isEditing = false
    let homeId: String
    private let api: APIClient

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    func load() async {
        do {
            let response: RentReportResponse = try await api.request(
                RealRentEndpoints.get(homeId: homeId)
            )
            apply(response.report)
        } catch let error as APIError {
            state = .error(message: error.errorDescription ?? "Couldn't load your rent.")
        } catch {
            state = .error(message: "Couldn't load your rent.")
        }
    }

    /// True when the save landed and the block benchmark is worth
    /// re-reading (the viewer's own report moves the meter).
    @discardableResult
    func save() async -> Bool {
        guard let amount = Self.parseRent(rentInput) else {
            saveError = "Enter the amount you pay each month."
            return false
        }
        isSaving = true
        saveError = nil
        defer { isSaving = false }
        do {
            let response: RentReportResponse = try await api.request(
                RealRentEndpoints.set(
                    homeId: homeId,
                    request: SetRentReportRequest(
                        monthlyRent: amount,
                        bedrooms: Self.parseBedrooms(bedroomsInput)
                    )
                )
            )
            apply(response.report)
            return true
        } catch let error as APIError {
            saveError = Self.writeFailureMessage(error, fallback: "Couldn't save your rent.")
            return false
        } catch {
            saveError = "Couldn't save your rent."
            return false
        }
    }

    @discardableResult
    func remove() async -> Bool {
        isSaving = true
        saveError = nil
        defer { isSaving = false }
        do {
            let response: RemoveRentReportResponse = try await api.request(
                RealRentEndpoints.delete(homeId: homeId)
            )
            guard response.removed else {
                saveError = "Couldn't remove your rent. Try again."
                return false
            }
            apply(nil)
            return true
        } catch let error as APIError {
            // Never silently reload: a failed withdrawal that leaves the
            // card exactly as it was reads as a dead button, and the
            // resident is left believing their figure is gone when it is
            // still counted.
            saveError = Self.writeFailureMessage(error, fallback: "Couldn't remove your rent.")
            return false
        } catch {
            saveError = "Couldn't remove your rent. Try again."
            return false
        }
    }

    /// A write failure in the resident's own terms.
    ///
    /// The route's 403 is `VERIFICATION_REQUIRED`, and that gate IS the
    /// product — a benchmark is only worth reading because the people in
    /// it proved they live there. `APIClient` maps 403 to `.forbidden`
    /// and drops the body, so the case is matched directly; the code is
    /// matched too, for any 4xx that keeps its body.
    static func writeFailureMessage(_ error: APIError, fallback: String) -> String {
        switch error {
        case .forbidden:
            return Self.verificationRequiredMessage
        case let .clientError(_, message):
            if APIError.code(in: message) == "VERIFICATION_REQUIRED" {
                return Self.verificationRequiredMessage
            }
            // 400 `BAD_AMOUNT` arrives here: the server's own sentence
            // names the fence ($50–$50,000/mo), so it beats anything
            // this client could guess.
            return error.errorDescription ?? fallback
        default:
            return error.errorDescription ?? fallback
        }
    }

    static let verificationRequiredMessage =
        "Verify your address to add your rent — a block benchmark is only worth reading because the people in it proved they live there."

    func beginEditing() {
        saveError = nil
        isEditing = true
    }

    func cancelEditing() {
        saveError = nil
        isEditing = false
        if case let .loaded(report) = state { fill(from: report) }
    }

    private func apply(_ report: RentReport?) {
        isEditing = false
        saveError = nil
        guard let report else {
            state = .none
            rentInput = ""
            bedroomsInput = ""
            return
        }
        state = .loaded(report)
        fill(from: report)
    }

    private func fill(from report: RentReport) {
        rentInput = String(Int(report.monthlyRent.rounded()))
        bedroomsInput = report.bedrooms.map(String.init) ?? ""
    }

    /// "$2,400", "2,400" and "2400" all name the same monthly figure.
    static func parseRent(_ raw: String) -> Double? {
        let cleaned = raw.filter { $0.isNumber || $0 == "." }
        guard let value = Double(cleaned), value > 0 else { return nil }
        return value
    }

    /// Blank means "use the home's own bedroom count" — the server's
    /// fallback — so an empty field is omitted, never sent as zero.
    static func parseBedrooms(_ raw: String) -> Int? {
        let cleaned = raw.filter(\.isNumber)
        return cleaned.isEmpty ? nil : Int(cleaned)
    }
}

// MARK: - Section

struct PlaceRealRentSection: View {
    let env: PlaceSectionEnvelope
    let detail: PlaceDetailViewModel
    let vm: PlaceRealRentViewModel

    private enum Render {
        case locked
        case unavailable(reason: String, retry: Bool)
        case building(PlaceRealRentData)
        case ready(PlaceRealRentData)
    }

    private var render: Render {
        if env.access == .locked {
            return .locked
        }
        if env.status == .error {
            return .unavailable(
                reason: env.unavailableReason ?? "We couldn't read your block's rents just now.",
                retry: true
            )
        }
        guard env.status != .unavailable, let data = env.realRent else {
            return .unavailable(
                reason: env.unavailableReason ?? "We could not place this home on a block yet.",
                retry: false
            )
        }
        // A state this build has never heard of renders as progress —
        // never as a benchmark, so it can never imply amounts.
        return data.state == .ready ? .ready(data) : .building(data)
    }

    var body: some View {
        switch render {
        case .locked:
            PlaceLockedCard(
                icon: .handCoins,
                title: "What your block actually pays",
                reason: PlacePresentation.lockReason(env),
                cta: "Verify address",
                onTap: nil
            )
        case let .unavailable(reason, retry):
            RealRentUnavailableCard(reason: reason, retry: retry, detail: detail)
        case let .building(data):
            VStack(alignment: .leading, spacing: Spacing.s2) {
                RealRentBuildingCard(data: data)
                RealRentContribution(vm: vm, detail: detail)
            }
        case let .ready(data):
            VStack(alignment: .leading, spacing: Spacing.s2) {
                RealRentReadyCard(data: data)
                RealRentContribution(vm: vm, detail: detail)
            }
        }
    }
}

// MARK: - Building: the block's progress toward its own benchmark

private struct RealRentBuildingCard: View {
    let data: PlaceRealRentData

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 11) {
                HStack(spacing: 11) {
                    PlaceIconTile(icon: .handCoins, tone: .home, size: 34)
                    Text("Real rents on your block")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: 0)
                    PlaceChip(model: PlaceChipModel(tone: .sky, text: "\(data.reports) of \(data.needed)"))
                }
                Text(data.summary)
                    .font(.system(size: 13.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                PlaceProgressBar(current: data.reports, needed: data.needed)
                Text("\(data.needed) shared rents open the block's real range — the quartiles verified neighbors here actually pay, which a county-wide estimate can never tell you. Add yours, and ask a neighbor: the invite cards live on your Block page.")
                    .font(.system(size: 12.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .accessibilityIdentifier("place.realRent.building")
    }
}

// MARK: - Ready: quartiles and a sample size, never a row

private struct RealRentReadyCard: View {
    let data: PlaceRealRentData

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                    Text("\(PlacePresentation.money(data.rentMedian) ?? "—") / mo")
                        .font(.system(size: 26, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: 0)
                    if let chip = standingChip {
                        PlaceChip(model: chip)
                    }
                }
                Text(medianCaption)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextMuted)
                quartiles
                track
                Text(data.summary)
                    .font(.system(size: 13.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                if let scopeNote {
                    Text(scopeNote)
                        .font(.system(size: 12.5))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                if let standingNote {
                    Text(standingNote)
                        .font(.system(size: 12.5))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Text("Reported by verified residents of this block — quartiles and a sample size only, never a neighbor's own figure.")
                    .font(.system(size: 11.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
        .accessibilityIdentifier("place.realRent.ready")
    }

    /// How much weight the median carries. The sample size is a contract
    /// field in its own right — it must be on the card, not left to
    /// whatever sentence the server happens to compose.
    private var medianCaption: String {
        guard let sample = data.sampleSize ?? (data.reports > 0 ? data.reports : nil) else {
            return "Median rent on your block"
        }
        return "Median rent on your block · \(sample) verified \(sample == 1 ? "report" : "reports")"
    }

    /// Prose labels, not percentile jargon: "25th" reads as a statistic,
    /// "Lower quarter" reads as a fact about the block. Web and Android
    /// both print exactly these three, so the wording is contract.
    private var quartiles: some View {
        HStack(spacing: Spacing.s3) {
            quartile(label: "Lower quarter", amount: data.rentP25)
            quartile(label: "Median", amount: data.rentMedian)
            quartile(label: "Upper quarter", amount: data.rentP75)
        }
    }

    private func quartile(label: String, amount: Double?) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label.uppercased())
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextMuted)
            Text(PlacePresentation.money(amount) ?? "—")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The middle-half band with the viewer's own position marked. The
    /// marker is the viewer's own figure — nobody else's ever appears.
    private var track: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.Color.appSurfaceSunken).frame(height: 7)
                if let start = bandStart, let width = bandWidth {
                    Capsule().fill(Theme.Color.homeBg)
                        .frame(width: max(proxy.size.width * width, 7), height: 7)
                        .offset(x: proxy.size.width * start)
                }
                if let position {
                    Circle().fill(Theme.Color.primary600)
                        .frame(width: 13, height: 13)
                        .overlay(Circle().strokeBorder(Theme.Color.appSurface, lineWidth: 2))
                        .offset(x: proxy.size.width * position - 6.5)
                }
            }
            .frame(height: 13)
        }
        .frame(height: 13)
    }

    private var bounds: (low: Double, high: Double)? {
        guard let p25 = data.rentP25, let p75 = data.rentP75 else { return nil }
        let span = max(p75 - p25, 1)
        return (p25 - span * 0.75, p75 + span * 0.75)
    }

    private var bandStart: Double? {
        guard let p25 = data.rentP25, let bounds else { return nil }
        return (p25 - bounds.low) / (bounds.high - bounds.low)
    }

    private var bandWidth: Double? {
        guard let p25 = data.rentP25, let p75 = data.rentP75, let bounds else { return nil }
        return (p75 - p25) / (bounds.high - bounds.low)
    }

    private var position: Double? {
        guard let own = data.yourRent, let bounds else { return nil }
        return min(max((own - bounds.low) / (bounds.high - bounds.low), 0.04), 0.96)
    }

    /// Bedroom scope is stated, never implied: a studio must never be
    /// quietly priced against a four-bedroom.
    private var scopeNote: String? {
        switch data.scope {
        case .bedrooms:
            guard let bedrooms = data.bedrooms else { return nil }
            return bedrooms == 0
                ? "Matched to studios on your block."
                : "Matched to \(bedrooms)-bedroom homes on your block."
        case .allSizes:
            return "Pooled across homes of all sizes — not enough same-size reports on your block yet."
        case .unknown, .none:
            return nil
        }
    }

    private var standingChip: PlaceChipModel? {
        PlacePresentation.realRentStandingChip(data.standing)
    }

    /// A band position only — never a rank, never a count of who pays
    /// more, which would be a headcount of identifiable households.
    private var standingNote: String? {
        guard let own = PlacePresentation.money(data.yourRent) else { return nil }
        switch data.standing {
        case .belowBand: return "You pay \(own)/mo — below the middle half of your block."
        case .aboveBand: return "You pay \(own)/mo — above the middle half of your block."
        case .inBand: return "You pay \(own)/mo — inside the middle half of your block."
        case .unknown, .none: return "You pay \(own)/mo."
        }
    }
}

// MARK: - Unavailable / error

private struct RealRentUnavailableCard: View {
    let reason: String
    let retry: Bool
    let detail: PlaceDetailViewModel

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Real rents on your block")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(reason)
                    .font(.system(size: 13.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextMuted)
                if retry {
                    Button {
                        Task { await detail.refresh() }
                    } label: {
                        Text("Try again")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(Theme.Color.primary600)
                }
            }
        }
        .accessibilityIdentifier("place.realRent.unavailable")
    }
}
