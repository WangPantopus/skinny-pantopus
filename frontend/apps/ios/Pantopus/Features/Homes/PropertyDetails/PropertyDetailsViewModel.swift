//
//  PropertyDetailsViewModel.swift
//  Pantopus
//
//  Backs `PropertyDetailsView` (A.4 / A13.5). Reads the home's property
//  fields from `GET /api/homes/:id/property-details` (route
//  `backend/routes/home.js:1949`) and projects them into a `.clean`
//  state. The property facts + address are backed for everyone who can
//  open the home; the county record (ATTOM) sections for its verified
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

    let homeId: String
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
        let content = Self.content(from: snapshot.value.home, countyRecord: snapshot.value.countyRecord)
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
    static func content(from home: PropertyHomeDTO, countyRecord: PropertyCountyRecordDTO? = nil) -> PropertyDetailsContent {
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
        let sections = (countyRecord?.sections ?? []).compactMap { section -> PropertyRecordSection? in
            let rows = section.rows.map {
                PropertyFactRow(id: $0.id, label: $0.label, value: $0.value, mono: $0.mono ?? false)
            }
            return rows.isEmpty ? nil : PropertyRecordSection(id: section.id, title: section.title, rows: rows, note: section.note)
        }

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
            banner: nil
        )
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
