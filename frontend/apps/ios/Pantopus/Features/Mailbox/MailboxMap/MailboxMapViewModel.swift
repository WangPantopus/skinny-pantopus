//
//  MailboxMapViewModel.swift
//  Pantopus
//
//  A11.4 Mailbox map view-model. Owns the sheet detent, the active
//  category-chip filter, and the pin↔detail selection link.
//
//  DOMAIN CAVEAT: the *screen* is a venue directory (post offices / drop
//  boxes / lockers / carriers, with operating hours + services), but the
//  only backend "map" route is `GET /api/mailbox/v2/p3/map/pins`, which
//  returns `HomeMapPin` rows — household / neighborhood annotations
//  (permits, deliveries, notices, civic alerts). There is no
//  venue-directory backend, so `load()` fetches pins and projects them
//  into `MailboxSpot` lossily (no hours / services; deterministic
//  synthetic canvas positions). Mirrors Android
//  `ui/screens/mailbox/mailbox_map/MailboxMapViewModel.kt`.
//
//  No pins → `.populated([])` (the sheet renders its inline empty note);
//  a transport failure → `.error(message:)` with Retry. The sample
//  directory is a preview / snapshot seam only — it is never surfaced as
//  if it were live data.
//

import CoreGraphics
import Foundation

@Observable
@MainActor
public final class MailboxMapViewModel {
    /// Current render state. Mutated through `load` / `select` / `backToList`.
    public private(set) var state: MailboxMapState = .loading
    /// Sheet detent for the populated rail (A11 archetype contract).
    public var detent: MapListHybridDetent = .standard
    /// Active category chip; `nil` is the "All" sentinel.
    public private(set) var activeKind: MailboxSpotKind?
    /// Current weekday (`Calendar` convention, 1 = Sun … 7 = Sat) used to
    /// highlight the week-hour strip. Injected so previews + tests stay
    /// deterministic.
    public let todayWeekday: Int

    /// `nil` in the preview / test seam — that path projects `seedSpots`
    /// synchronously instead of hitting the network.
    private let api: APIClient?
    /// Spots the preview / test seam surfaces. Empty in production.
    private let seedSpots: [MailboxSpot]
    /// When set, `load()` surfaces this state verbatim — lets previews +
    /// snapshot hosts pin the loading / error / selected frames.
    private let seededState: MailboxMapState?
    /// Working set the screen filters / selects against — the fetched
    /// pins in production, the seeded spots in previews.
    private var workingSpots: [MailboxSpot] = []

    /// Production seam. `APIClient` is internal, so this initialiser is
    /// internal too (see `MembersListViewModel.swift:204`).
    init(
        api: APIClient = .shared,
        todayWeekday: Int = Calendar.current.component(.weekday, from: Date())
    ) {
        self.api = api
        seedSpots = []
        seededState = nil
        self.todayWeekday = todayWeekday
    }

    /// Preview / test seam — no network, projects `spots` synchronously.
    /// `spots` is deliberately non-defaulted so `MailboxMapViewModel()`
    /// unambiguously resolves to the production initialiser.
    public init(
        spots: [MailboxSpot],
        seededState: MailboxMapState? = nil,
        todayWeekday: Int = Calendar.current.component(.weekday, from: Date())
    ) {
        api = nil
        seedSpots = spots
        self.seededState = seededState
        self.todayWeekday = todayWeekday
    }

    /// Fetch `HomeMapPin` rows and project them into the rail. A seeded
    /// state wins (previews / snapshot frames); without an API client the
    /// seeded spots are surfaced synchronously.
    public func load() async {
        if let seededState {
            workingSpots = seedSpots
            state = seededState
            return
        }
        guard let api else {
            workingSpots = seedSpots
            state = .populated(filtered(seedSpots))
            return
        }
        state = .loading
        do {
            let response: HomeMapPinsResponse = try await api.request(
                MailboxP3Endpoints.mapPins()
            )
            let spots = response.pins.map(Self.spot(from:))
            workingSpots = spots
            state = .populated(filtered(spots))
        } catch {
            workingSpots = []
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load mailbox spots."
            )
        }
    }

    public func refresh() async {
        await load()
    }

    /// Tap a pin / rail card → pin-detail. The full spot list rides
    /// along so the context strip can keep drawing dimmed pins. The
    /// category filter is left untouched — the selected frame's chip
    /// highlight follows the spot's kind purely in the view, so "Back to
    /// list" restores whatever filter the user had.
    public func select(_ id: String) {
        guard let spot = workingSpots.first(where: { $0.id == id }) else { return }
        state = .selected(spot: spot, spots: workingSpots)
    }

    /// "Back to list" → restore the populated rail under the current
    /// filter.
    public func backToList() {
        state = .populated(filtered(workingSpots))
    }

    /// Category-chip tap. Applies the filter and surfaces the populated
    /// rail — also the way "back to list" works when a chip is tapped
    /// from an open detail panel.
    public func selectKind(_ kind: MailboxSpotKind?) {
        activeKind = kind
        state = .populated(filtered(workingSpots))
    }

    public func setDetent(_ detent: MapListHybridDetent) {
        self.detent = detent
    }

    private func filtered(_ spots: [MailboxSpot]) -> [MailboxSpot] {
        guard let activeKind else { return spots }
        return spots.filter { $0.kind == activeKind }
    }

    // MARK: - HomeMapPin → MailboxSpot projection (lossy; see caveat above)

    private static let pinFractionMin: CGFloat = 0.15
    private static let pinFractionSpan = 70
    private static let pinFractionDenominator: CGFloat = 100

    /// Best-effort `pin_type` → venue kind. Only `civic` overlaps cleanly.
    /// Mirrors Android `spotKindFor`.
    static func spotKind(forPinType pinType: String?) -> MailboxSpotKind {
        switch pinType {
        case "delivery": .carrier
        case "civic", "permit", "notice", "utility_work", "community": .civic
        default: .drop
        }
    }

    static func spot(from pin: HomeMapPinDTO) -> MailboxSpot {
        MailboxSpot(
            id: pin.id,
            kind: spotKind(forPinType: pin.pinType),
            name: pin.title ?? "Map pin",
            address: pin.body ?? "",
            isOpen: true,
            hoursLabel: "",
            statusLabel: pin.visibleTo ?? "",
            walkLabel: "",
            lastPickupLabel: nil,
            services: [],
            weekHours: [],
            // No geo→canvas projection exists for this stylized map; spread
            // pins deterministically by id so they don't overlap.
            mapX: fraction(of: pin.id),
            mapY: fraction(of: pin.id + "y")
        )
    }

    private static func fraction(of seed: String) -> CGFloat {
        pinFractionMin
            + CGFloat(Int(stableHash(seed) % UInt64(pinFractionSpan))) / pinFractionDenominator
    }

    /// FNV-1a over the UTF-8 bytes. `String.hashValue` is seeded per
    /// process, so it would move pins on every launch; this stays put.
    private static func stableHash(_ value: String) -> UInt64 {
        var hash: UInt64 = 0xCBF2_9CE4_8422_2325
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x0000_0100_0000_01B3
        }
        return hash
    }
}
