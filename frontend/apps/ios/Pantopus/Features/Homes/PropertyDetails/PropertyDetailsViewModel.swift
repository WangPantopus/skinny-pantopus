//
//  PropertyDetailsViewModel.swift
//  Pantopus
//
//  Backs `PropertyDetailsView` (A.4 / A13.5). Reads the home's property
//  fields from `GET /api/homes/:id/property-details` (route
//  `backend/routes/home.js:1949`) and projects them into a `.clean`
//  state. The property facts + address are backed for everyone who can
//  open the home; the county record sections for its verified
//  owners, whom the server sends them to. The Verification (provenance)
//  section + the mismatch banner have no clean backend source, so they
//  stay empty / nil. An injectable `loader` seam (non-nil) bypasses the
//  network for previews + tests.
//
//  Instant Screens: the read goes through the screen store (a home's facts,
//  10 minutes), so coming back shows the copy in the first frame and asks
//  again only once it is out of date. Only an owner's or household member's
//  open-ended access, as the Home dashboard last confirmed it, sees the copy
//  before the re-check (`HomeCopyGate`); anyone else waits for the server.
//

import Foundation
import Observation

@Observable
@MainActor
final class PropertyDetailsViewModel {
    /// Currently displayed state.
    private(set) var state: PropertyDetailsState = .loading
    /// "Couldn't refresh. Showing 3:42 PM." once a failed refresh leaves an old copy on screen.
    private(set) var staleNotice: String?
    /// A change to the household's facts is on its way.
    private(set) var savingFacts = false

    /// Link and confirm: the group "Fix something" saves for after the county's page, when the screen shows it.
    var countyCheckGroup: String? {
        switch state {
        case let .clean(content), let .mismatch(content): content.household?.countyCheck?.group
        case .loading, .error: nil
        }
    }

    let homeId: String
    private let api: APIClient
    private let store: ScreenStore
    /// Preview/test seam. When non-nil, `load()` projects this loader's
    /// output instead of calling the backend.
    private let loader: (@Sendable (String) throws -> PropertyDetailsContent)?

    init(
        homeId: String,
        api: APIClient = .shared,
        loader: (@Sendable (String) throws -> PropertyDetailsContent)? = nil
    ) {
        self.homeId = homeId
        self.api = api
        store = ScreenStore.store(for: api)
        self.loader = loader
        // The store's copy shows in the first frame (Instant Screens), for household access only.
        if loader == nil, HomeCopyGate.showsCopy(homeId: homeId, store: store),
           let copy = store.peek(endpoint, as: PropertyDetailsResponse.self) {
            show(copy)
        }
    }

    /// On appear: the copy at once, re-checked once it is out of date. The
    /// preview/test loader runs once.
    func load() async {
        guard loader == nil else {
            guard case .loading = state else { return }
            applyLoader()
            return
        }
        await fetch(force: false)
    }

    /// Retry: always asks the server.
    func refresh() async {
        guard loader == nil else {
            applyLoader()
            return
        }
        await fetch(force: true)
    }

    /// Confirm, correct or undo the household's facts, then show the server's answer.
    /// False leaves everything on screen as it was.
    @discardableResult
    func saveFacts(_ changes: [HouseholdFactChange]) async -> Bool {
        guard !savingFacts, !changes.isEmpty else { return false }
        savingFacts = true
        defer { savingFacts = false }
        do {
            let _: HouseholdWriteResponse = try await api.request(HomesEndpoints.updateHouseholdFacts(homeId: homeId, changes: changes))
        } catch {
            return false
        }
        await fetch(force: true)
        return true
    }

    /// "Report a problem": it reaches review, and the page stays as it is but for saying so.
    func reportProblem(section: String, field: String?, note: String?) async -> Bool {
        let request = RecordProblemRequest(section: section, field: field, note: note)
        do {
            let _: HouseholdWriteResponse = try await api.request(HomesEndpoints.reportRecordProblem(homeId: homeId, request: request))
        } catch {
            return false
        }
        await fetch(force: true)
        return true
    }

    /// "Is this your layout?": yes, no or undo, then show the server's answer.
    func answerFloorPlan(_ answer: String) async {
        guard !savingFacts else { return }
        savingFacts = true
        defer { savingFacts = false }
        do {
            let _: HouseholdWriteResponse = try await api.request(HomesEndpoints.answerFloorPlan(homeId: homeId, answer: answer))
        } catch {
            return
        }
        await fetch(force: true)
    }

    private var endpoint: Endpoint {
        HomesEndpoints.propertyDetails(homeId: homeId)
    }

    private var showsContent: Bool {
        switch state {
        case .clean, .mismatch: true
        case .loading, .error: false
        }
    }

    private func fetch(force: Bool) async {
        let household = HomeCopyGate.showsCopy(homeId: homeId, store: store)
        let gate: @Sendable (PropertyDetailsResponse) -> Bool = { _ in household }
        do {
            // Without household access in hand, every visit waits for the server.
            try await store.show(
                endpoint,
                as: PropertyDetailsResponse.self,
                kind: .place,
                topics: [ScreenTopic.home(homeId)],
                force: force || !household,
                showsBeforeRecheck: gate
            ) { show($0) }
        } catch is CancellationError {
            return
        } catch {
            // A refusal (403/404) or nothing on screen: the error. Otherwise the copy stays.
            guard showsContent, !ScreenStore.isRefusal(error) else {
                state = .error(message: "Couldn't load property details. Pull to retry.")
                return
            }
            staleNotice = store.peek(endpoint, as: PropertyDetailsResponse.self)?.refreshNotice
        }
    }

    private func show(_ snapshot: ScreenSnapshot<PropertyDetailsResponse>) {
        staleNotice = snapshot.refreshNotice
        let content = Self.content(
            from: snapshot.value.home,
            countyRecord: snapshot.value.countyRecord,
            household: snapshot.value.household
        )
        state = content.banner == nil ? .clean(content) : .mismatch(content)
    }

    private func applyLoader() {
        guard let loader else { return }
        do {
            let content = try loader(homeId)
            state = content.banner == nil ? .clean(content) : .mismatch(content)
        } catch {
            state = .error(message: "Couldn't load property details. Pull to retry.")
        }
    }

    /// Map the backend `home` and the verified owner's county record onto
    /// the screen's projection. Verification stays empty (no clean source)
    /// and the banner is never raised from the backend, so this always
    /// yields the clean state.
    static func content(
        from home: PropertyHomeDTO,
        countyRecord: PropertyCountyRecordDTO? = nil,
        household: HouseholdPartDTO? = nil
    ) -> PropertyDetailsContent {
        let line1 = [home.address?.nonBlank, home.unitNumber?.nonBlank]
            .compactMap { $0 }
            .joined(separator: " · ")
        let stateZip = [home.state?.nonBlank, (home.zipcode ?? home.zipCode)?.nonBlank]
            .compactMap { $0 }
            .joined(separator: " ")
        let line2 = [home.city?.nonBlank, stateZip.nonBlank]
            .compactMap { $0 }
            .joined(separator: ", ")

        var facts: [PropertyFactRow] = []
        if let type = home.homeType?.nonBlank {
            facts.append(PropertyFactRow(id: "type", label: "Type", value: Self.humanize(type)))
        }
        if let year = home.yearBuilt {
            facts.append(PropertyFactRow(id: "year", label: "Year built", value: "\(year)", mono: true))
        }
        if let beds = home.bedrooms {
            facts.append(PropertyFactRow(id: "beds", label: "Bedrooms", value: "\(beds)", mono: true))
        }
        if let baths = home.bathrooms {
            facts.append(PropertyFactRow(id: "baths", label: "Bathrooms", value: Self.formatBaths(baths), mono: true))
        }
        if let sqft = home.sqFt {
            facts.append(PropertyFactRow(id: "interior", label: "Interior", value: "\(sqft.formatted()) sq ft", mono: true))
        }
        if let lot = home.lotSqFt {
            facts.append(PropertyFactRow(id: "lot", label: "Lot", value: "\(lot.formatted()) sq ft", mono: true))
        }

        // The server words and formats every county-record row.
        let sections = (countyRecord?.sections ?? []).compactMap(Self.recordSection)

        return PropertyDetailsContent(
            address: PropertyAddress(
                line1: line1.isEmpty ? "Address unavailable" : line1,
                line2: line2,
                latitude: home.location?.latitude,
                longitude: home.location?.longitude
            ),
            propertyFacts: facts,
            recordSections: sections,
            recordFooter: sections.isEmpty ? nil : countyRecord?.footer?.nonBlank,
            verification: [],
            banner: nil,
            household: household.map {
                PropertyHouseholdContent(
                    sections: $0.sections.compactMap(Self.recordSection),
                    groups: $0.groups,
                    questions: $0.questions,
                    countyPage: $0.countyPage,
                    countyCheck: $0.countyCheck,
                    floorPlan: $0.floorPlan
                )
            }
        )
    }

    private static func recordSection(_ section: PropertyRecordSectionDTO) -> PropertyRecordSection? {
        let rows = section.rows.map {
            // Where the row came from, and under it what stands beside it ("County record: 3").
            let sub = [$0.tag?.nonBlank, $0.note?.nonBlank].compactMap { $0 }.joined(separator: "\n")
            return PropertyFactRow(id: $0.id, label: $0.label, value: $0.value, sub: sub.nonBlank, mono: $0.mono ?? false)
        }
        return rows.isEmpty ? nil : PropertyRecordSection(id: section.id, title: section.title, rows: rows, note: section.note)
    }

    private static func humanize(_ raw: String) -> String {
        let spaced = raw.replacingOccurrences(of: "_", with: " ")
        return spaced.prefix(1).uppercased() + spaced.dropFirst()
    }

    private static func formatBaths(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(value)
    }
}

private extension String {
    var nonBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
