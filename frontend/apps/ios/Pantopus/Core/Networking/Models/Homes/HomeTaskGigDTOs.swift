import Foundation

struct HomeTaskGigState: Decodable {
    let ok: Bool
    let homeId: String
    let taskId: String
    let taskUpdatedAt: String
    let canPublish: Bool
    let gigId: String?
    let taskSession: HomeTaskSession
    private enum CodingKeys: String, CodingKey {
        case ok, homeId = "home_id", taskId = "task_id", taskUpdatedAt = "task_updated_at"
        case canPublish = "can_publish", gigId = "gig_id", taskSession = "task_session"
    }

    func matches(home: String, task: String) -> Bool {
        ok && homeId == home && taskId == task && HomeTaskRecurrenceDate.parse(taskUpdatedAt) != nil
            && (gigId == nil || gigId.flatMap(UUID.init(uuidString:)) != nil)
    }
}

struct HomeTaskGigFields: Codable, Equatable {
    struct Location: Codable, Equatable {
        var mode = "address"
        let address: String
        let latitude: Double
        let longitude: Double
        let city: String?
        let state: String?
        let zip: String?
        var valid: Bool {
            mode == "address" && (3...500).contains(address.count) && latitude.isFinite && longitude.isFinite
                && abs(latitude) <= 90 && abs(longitude) <= 180
        }
    }

    let title: String
    let description: String
    let price: Decimal
    let category: String
    let cancellationPolicy: String
    let location: Location
    private enum CodingKeys: String, CodingKey {
        case title, description, price, category, location, cancellationPolicy = "cancellation_policy"
    }

    var valid: Bool {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        var original = price, rounded = Decimal()
        NSDecimalRound(&rounded, &original, 2, .plain)
        return (5...255).contains(trimmed.count) && title.count <= 255
            && description.trimmingCharacters(in: .whitespacesAndNewlines).count >= 10
            && !price.isNaN && price > 0 && price <= (Decimal(9_999_999_999) / 100) && rounded == price
            && (1...100).contains(category.count) && ["flexible", "standard", "strict"].contains(cancellationPolicy) && location.valid
    }
}

struct HomeTaskGigReceipt: Codable, Equatable {
    let homeId: String
    let actorId: String
    let taskId: String
    let requestId: String
    let gigId: String
    let requestHash: String
    let createdAt: String
    private enum CodingKeys: String, CodingKey {
        case homeId = "home_id", actorId = "actor_id", taskId = "task_id", requestId = "request_id"
        case gigId = "gig_id", requestHash = "request_hash", createdAt = "created_at"
    }

    func matches(_ draft: HomeTaskGigDraft) -> Bool {
        homeId == draft.homeId && actorId == draft.actorId && taskId == draft.taskId && requestId == draft.requestId
            && UUID(uuidString: gigId) != nil && HomeClaimReviewSnapshot.validToken(requestHash)
            && HomeTaskRecurrenceDate.parse(createdAt) != nil
    }
}

struct HomeTaskGigResponse: Decodable {
    struct Gig: Decodable {
        let id: String
        let userId: String
        let createdBy: String
        let title: String
        let description: String
        let price: Decimal
        let status: String
        private enum CodingKeys: String,
            CodingKey { case id, title, description, price, status, userId = "user_id", createdBy = "created_by" }
    }

    let gig: Gig
    let publicationReceipt: HomeTaskGigReceipt
    let taskSession: HomeTaskSession
    let replayed: Bool
    private enum CodingKeys: String,
        CodingKey { case gig, replayed, publicationReceipt = "publication_receipt", taskSession = "task_session" }
    func matches(_ draft: HomeTaskGigDraft) -> Bool {
        publicationReceipt.matches(draft) && gig.id == publicationReceipt.gigId && gig.userId == draft.actorId && gig.createdBy == draft
            .actorId
            && ["open", "assigned", "in_progress", "completed", "cancelled"].contains(gig.status)
            &&
            (replayed ||
                (gig.title == draft.fields.title && gig.description == draft.fields.description && gig.price == draft.fields.price))
            && (draft.confirmed == nil || draft.confirmed == publicationReceipt)
    }
}
