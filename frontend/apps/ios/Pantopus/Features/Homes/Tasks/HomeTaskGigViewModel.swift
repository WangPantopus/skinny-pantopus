import Foundation
import Observation

@Observable
@MainActor
final class HomeTaskGigViewModel {
    enum Failure: LocalizedError, Equatable {
        case changedRequest, storage, changedSource
        var errorDescription: String? {
            switch self {
            case .changedRequest: "The original publication changed elsewhere. Reload to recover it."
            case .storage: "The original publication could not be read. It has been kept; no new publication was submitted."
            case .changedSource: "The household task changed. Reload and review it before publishing."
            }
        }
    }

    private(set) var task: HomeTaskDTO?
    private(set) var state: HomeTaskGigState?
    private(set) var pending: HomeTaskGigDraft?
    private(set) var loading = false
    private(set) var busy = false
    private(set) var error: String?
    private(set) var canDismiss = false
    var title = "" {
        didSet { reviewed = false }
    }

    var description = "" {
        didSet { reviewed = false }
    }

    var budget = "" {
        didSet { reviewed = false }
    }

    var category = "General" {
        didSet { reviewed = false }
    }

    var policy = "standard" {
        didSet { reviewed = false }
    }

    var addressText = "" {
        didSet { location = nil
            suggestions = []
            reviewed = false
            addressRevision += 1
        }
    }

    var reviewed = false
    private(set) var location: HomeTaskGigFields.Location?
    private(set) var suggestions: [GeoSuggestion] = []
    private(set) var findingAddress = false
    private let api: APIClient
    private let access: HomeTaskAccess
    private let store: any PendingHomeTaskGigStoring
    private let taskId: String
    private let actor: String
    private let origin: String
    private let scope: String
    private var visible = false
    private var reloadQueued = false
    private var addressRevision = 0
    private static var active = Set<String>()

    init(
        homeId: String,
        taskId: String,
        api: APIClient = .shared,
        access: HomeTaskAccess? = nil,
        store: any PendingHomeTaskGigStoring = PendingHomeTaskGigStore()
    ) {
        let access = access ?? HomeTaskAccess(homeId: homeId, api: api)
        self.api = api
        self.access = access
        self.store = store
        self.taskId = taskId
        actor = access.openingActorId ?? ""
        origin = api.apiBaseURL.absoluteString
        scope = "gig-publication-v1|\(origin)|\(actor)|\(homeId)|\(taskId)"
    }

    var activationRevision: Int {
        access.lifecycleRevision
    }

    var isCurrent: Bool {
        access.isCurrent
    }

    var isActive: Bool {
        visible && isCurrent
    }

    var canEdit: Bool {
        isActive && !busy && !loading && pending == nil && state?.canPublish == true
    }

    var canPublish: Bool {
        canEdit && reviewed && fields != nil && !findingAddress
    }

    func activate(ifCurrent revision: Int) async {
        guard revision == activationRevision, !Task.isCancelled else { return }
        visible = true
        await load()
    }

    func load() async {
        guard isActive, !Task.isCancelled else { return }
        if busy { reloadQueued = true
            return
        }
        access.invalidatePending()
        let revision = activationRevision
        loading = true
        task = nil
        state = nil
        pending = nil
        error = nil
        canDismiss = false
        reviewed = false
        do {
            let (task, state) = try await currentSource(revision)
            let saved = try readSaved()
            try current(revision)
            self.task = task
            self.state = state
            pending = saved
        } catch { record(error, revision: revision) }
        if revision == activationRevision { loading = false }
    }

    private func currentSource(_ revision: Int) async throws -> (HomeTaskDTO, HomeTaskGigState) {
        let task = try await access.detail(taskId: taskId)
        try current(revision)
        let state = try await access.gigPublication(taskId: taskId)
        try current(revision)
        guard task.updatedAt == state.taskUpdatedAt else { throw Failure.changedSource }
        return (task, state)
    }

    func publish() async {
        guard canPublish, let fields else { return }
        await perform(fields: fields)
    }

    func retry() async {
        guard pending != nil, pending?.confirmed == nil else { return }
        await perform(fields: nil)
    }

    private func perform(fields: HomeTaskGigFields?) async {
        guard begin() else { return }
        let revision = activationRevision
        defer { finish() }
        do {
            try current(revision)
            guard try readSaved() == pending else { throw Failure.changedRequest }
            let draft: HomeTaskGigDraft
            if let fields {
                guard pending == nil, fields.valid, let state, state.canPublish else { throw Failure.changedSource }
                draft = HomeTaskGigDraft(
                    version: 1,
                    origin: origin,
                    actorId: actor,
                    homeId: access.homeId,
                    taskId: taskId,
                    requestId: UUID().uuidString.lowercased(),
                    expectedUpdatedAt: state.taskUpdatedAt,
                    fields: fields
                )
                guard draft.matches(origin: origin, home: access.homeId, task: taskId, actor: actor) else { throw APIError.invalidResponse }
                try store.save(draft, scope: scope, matching: nil)
                pending = draft
            } else {
                guard let original = pending, original.confirmed == nil else { throw Failure.changedRequest }
                draft = original
            }
            try current(revision)
            let response = try await access.publishGig(draft) {
                try self.current(revision)
                guard try self.readSaved() == draft else { throw Failure.changedRequest }
            }
            try current(revision)
            var confirmed = draft
            confirmed.confirmed = response.publicationReceipt
            try store.save(confirmed, scope: scope, matching: draft)
            pending = confirmed
            let (task, state) = try await currentSource(revision)
            self.task = task
            self.state = state
            reviewed = false
        } catch { record(error, revision: revision) }
    }

    func acknowledge() async {
        guard let original = pending, original.confirmed != nil || canDismiss, begin() else { return }
        let revision = activationRevision
        defer { finish() }
        do {
            let (task, state) = try await currentSource(revision)
            guard try readSaved() == original else { throw Failure.changedRequest }
            try current(revision)
            try store.clear(scope: scope, matching: original)
            pending = nil
            self.task = task
            self.state = state
            reviewed = false
        } catch { record(error, revision: revision) }
    }

    func openGig() async -> String? {
        guard begin() else { return nil }
        let revision = activationRevision
        defer { finish() }
        do {
            let (task, state) = try await currentSource(revision)
            guard try readSaved() == pending else { throw Failure.changedRequest }
            try current(revision)
            let destination = pending?.confirmed?.gigId ?? state.gigId
            guard let destination, state.gigId == destination, UUID(uuidString: destination) != nil else { throw APIError.invalidResponse }
            self.task = task
            self.state = state
            return destination
        } catch { record(error, revision: revision)
            return nil
        }
    }

    private func begin() -> Bool {
        guard isActive, !busy, !loading, state != nil, Self.active.insert(scope).inserted else { return false }
        busy = true
        error = nil
        canDismiss = false
        return true
    }

    private func finish() {
        busy = false
        Self.active.remove(scope)
        if reloadQueued, isActive {
            reloadQueued = false
            let revision = activationRevision
            Task { await self.activate(ifCurrent: revision) }
        }
    }

    private func current(_ revision: Int) throws {
        try access.requireCurrent(revision)
        guard visible else { throw CancellationError() }
    }

    private func readSaved() throws -> HomeTaskGigDraft? {
        do {
            let saved = try store.load(scope: scope)
            guard saved == nil || saved?.matches(origin: origin, home: access.homeId, task: taskId, actor: actor) == true
            else { throw Failure.storage }
            return saved
        } catch { throw Failure.storage }
    }

    private func record(_ failure: any Error, revision: Int) {
        guard visible else { return }
        guard isCurrent else { retire()
            return
        }
        guard revision == activationRevision else { return }
        error = failure.localizedDescription
        if Self.accessEnded(failure) || failure as? Failure == .changedSource {
            task = nil
            state = nil
            pending = nil
            clearFields()
        }
        if case let APIError.clientError(status, body) = failure {
            canDismiss = status == 409 &&
                ["HOME_TASK_GIG_STALE", "HOME_TASK_GIG_NOT_READY", "HOME_TASK_GIG_LINKED", "HOME_TASK_GIG_RETIRED"]
                .contains(APIError.code(in: body) ?? "")
                || status == 400 && APIError.code(in: body) == "HOME_RECORD_INVALID"
        }
    }

    private static func accessEnded(_ failure: any Error) -> Bool {
        if failure as? HomeTaskAccess.AccessError == .denied { return true }
        switch failure {
        case APIError.unauthorized, APIError.forbidden, APIError.notFound: return true
        case let APIError.clientError(status, _): return [401, 403, 404].contains(status)
        default: return false
        }
    }

    private func clearFields() {
        title = ""
        description = ""
        budget = ""
        category = "General"
        policy = "standard"
        addressText = ""
        reviewed = false
    }

    func suspend() {
        visible = false
        access.invalidatePending()
        addressRevision += 1
        task = nil
        state = nil
        pending = nil
        loading = false
        findingAddress = false
        suggestions = []
        canDismiss = false
        error = nil
        reloadQueued = false
        reviewed = false
    }

    func retire() {
        suspend()
        clearFields()
        access.retire()
        error = HomeTaskAccess.AccessError.changed.localizedDescription
    }
}

extension HomeTaskGigViewModel {
    var fields: HomeTaskGigFields? {
        let amount = budget.replacingOccurrences(of: Locale.current.decimalSeparator ?? ".", with: ".")
        guard amount.range(of: #"^[0-9]+(?:\.[0-9]{1,2})?$"#, options: .regularExpression) != nil,
              let location, let price = Decimal(string: amount, locale: Locale(identifier: "en_US_POSIX")) else { return nil }
        let value = HomeTaskGigFields(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description.trimmingCharacters(in: .whitespacesAndNewlines),
            price: price,
            category: category,
            cancellationPolicy: policy,
            location: location
        )
        return value.valid ? value : nil
    }

    func searchAddress() async {
        guard canEdit, !findingAddress, addressText.trimmingCharacters(in: .whitespacesAndNewlines).count >= 3 else { return }
        let revision = activationRevision, queryRevision = addressRevision
        findingAddress = true
        error = nil
        suggestions = []
        defer { if revision == activationRevision { findingAddress = false } }
        do {
            let result: GeoAutocompleteResponse = try await api.request(GeoEndpoints.autocomplete(query: addressText))
            try current(revision)
            guard queryRevision == addressRevision else { return }
            suggestions = result.suggestions
            if suggestions.isEmpty { error = "No matching locations. Try a more complete address." }
        } catch { record(error, revision: revision) }
    }

    func chooseAddress(_ suggestion: GeoSuggestion) async {
        guard canEdit, !findingAddress, suggestions.contains(suggestion) else { return }
        let revision = activationRevision, queryRevision = addressRevision
        findingAddress = true
        error = nil
        defer { if revision == activationRevision { findingAddress = false } }
        do {
            let result: GeoResolveResponse = try await api.request(GeoEndpoints.resolve(suggestionId: suggestion.suggestionId))
            try current(revision)
            guard queryRevision == addressRevision else { return }
            let normalized = result.normalized
            guard let address = normalized.address, let latitude = normalized.latitude,
                  let longitude = normalized.longitude else { throw APIError.invalidResponse }
            let selected = HomeTaskGigFields.Location(
                address: address,
                latitude: latitude,
                longitude: longitude,
                city: normalized.city,
                state: normalized.state,
                zip: normalized.zipcode
            )
            guard selected.valid else { throw APIError.invalidResponse }
            addressText = address
            location = selected
        } catch { record(error, revision: revision) }
    }
}
