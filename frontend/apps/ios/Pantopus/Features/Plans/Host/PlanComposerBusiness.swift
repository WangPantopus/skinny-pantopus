//
//  PlanComposerBusiness.swift
//  Pantopus
//
//  Plans with businesses, boards B1 and B2: hosting as a business. The
//  composer offers "Host as" only when the server lists a business this
//  person may post for (`GET /api/plans/host-as`, empty for nearly everyone).
//  A business's plan keeps its kind's color, glyph and pin; it adds what
//  guests see it called (a label from the server's short list, never free
//  text), meets at one of the business's own locations (never a home, never
//  a place typed by hand), lets everyone in right away or has the business
//  approve each person, and is free. No price and no repeats in step 2.
//

import Foundation

extension PlanComposerModel {
    /// The plan is posted as a business.
    var isBusiness: Bool {
        hostAs != nil
    }

    /// The kind as the business posts it: its name for a business ("Sports") and its labels.
    var businessKind: PlanBusinessKindDTO? {
        hostAs?.kind(kind)
    }

    /// The business's location the plan meets at.
    var businessLocation: PlanBusinessLocationDTO? {
        hostAs?.locations.first { $0.id == businessLocationId }
    }

    /// The label's words ("Clinic").
    var businessLabelText: String? {
        businessKind?.labels.first { $0.key == businessLabel }?.text
    }

    func loadHostAs() async {
        guard let reply: PlanHostAsResponse = try? await PlanComposerHostAs.read() else { return }
        hostAsOptions = reply.businesses
    }

    /// Choosing (or dropping) a business: its main location, no label yet, everyone in right away.
    func applyBusinessDefaults() {
        businessLabel = nil
        letsEveryoneIn = true
        businessLocationId = hostAs?.primaryLocation?.id
        if hostAs != nil { businessKindChosen() }
    }

    /// A kind chosen for a business: no "now" (a business plans ahead), no prefilled neighbor title, and
    /// a label only when it belongs to this kind.
    func businessKindChosen() {
        startsNow = false
        whereKind = .publicPlace
        if kind != .watchParty, title == "Coffee walk" || title == "Playground morning" { title = "" }
        if let label = businessLabel, businessKind?.labels.contains(where: { $0.key == label }) != true { businessLabel = nil }
        spots = min(spots, hostAs?.limits.spotsMax ?? 30)
    }

    /// What stops a business's plan from being previewed, in the server's words where it has them.
    var businessProblem: String? {
        if businessLabel == nil { return "Choose what guests see it called." }
        if kind == .playdate, kidsAges.isEmpty { return "Pick the kids' ages." }
        if kind == .studyGroup, trimmedSubject.isEmpty { return "Add what you're studying." }
        if title.trimmingCharacters(in: .whitespaces).isEmpty { return "Give your plan a title." }
        if businessLocation == nil { return "Choose one of your business's locations." }
        let span = end.timeIntervalSince(start)
        if span < 15 * 60 { return "A plan lasts at least 15 minutes." }
        if span > 8 * 3600 { return "A plan lasts at most 8 hours." }
        let days = hostAs?.limits.daysAhead ?? 60
        if start > Date().addingTimeInterval(TimeInterval(days) * 86400) { return "Plans can start up to \(days) days ahead." }
        if start < Date().addingTimeInterval(-60) { return "Pick a time that hasn't passed." }
        return nil
    }

    /// `POST /api/plans` as the business (contract 5.5): no place, the location instead.
    func businessBody() -> CreatePlanBody? {
        guard let hostAs, let location = businessLocation, let label = businessLabel else { return nil }
        let trimmedAbout = about.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedNote = guestNote.trimmingCharacters(in: .whitespacesAndNewlines)
        var body = CreatePlanBody(
            kind: kind,
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            about: trimmedAbout.isEmpty ? nil : trimmedAbout,
            startsAt: start,
            endsAt: end,
            place: nil,
            spots: spots,
            autoRules: autoRules,
            joinRequirement: .located,
            details: details,
            guestNote: trimmedNote.isEmpty ? nil : trimmedNote,
            gps: nil
        )
        body.hostAs = PlanHostAsBody(businessUserId: hostAs.userId)
        body.businessLocationId = location.id
        body.label = label
        return body
    }
}

/// The "Host as" read, shared by the composer and the change screen.
@MainActor
enum PlanComposerHostAs {
    static func read(api: APIClient = .shared) async throws -> PlanHostAsResponse {
        try await api.request(PlansEndpoints.hostAs())
    }

    /// The business a plan is hosted by, as this person may post for it (its locations, kinds and limits).
    static func business(_ userId: String, api: APIClient = .shared) async -> PlanHostAsBusinessDTO? {
        try? await read(api: api).businesses.first { $0.userId == userId }
    }
}
