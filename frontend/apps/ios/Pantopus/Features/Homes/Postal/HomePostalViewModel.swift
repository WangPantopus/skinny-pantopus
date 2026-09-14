import Foundation
import Observation

struct HomePostalAddressForm {
    var line1 = ""
    var line2 = ""
    var city = ""
    var state = ""
    var postalCode = ""
    var country = "US"

    var body: JSONValue {
        .object([
            "line1": .string(line1), "line2": .string(line2), "city": .string(city),
            "state": .string(state), "postal_code": .string(postalCode), "country": .string(country)
        ])
    }

    init() {}
    init(_ address: HomeResidencyAddressSnapshot) {
        line1 = address.line1
        line2 = address.line2
        city = address.city
        state = address.state
        postalCode = address.postalCode
        country = address.country
    }
}

enum HomePostalNavigation { case home, residency, ownership, addHome }

@Observable
@MainActor
final class HomePostalViewModel {
    private let api: APIClient
    private let session: HomeClaimSessionScope
    private let scope: HomePostalScope
    private let coordinator: HomePostalCoordinator
    private var generation = 0
    private var visible = false
    private(set) var isWorking = false
    private(set) var opened = false
    private(set) var status: HomePostalStatus?
    private(set) var progress: PersonalHomeResidencyProgress?
    private(set) var error: String?
    var address = HomePostalAddressForm()
    var codeInput = ""

    init(scope: HomePostalScope, api: APIClient, session: HomeClaimSessionScope, store: any PendingHomePostalStoring) {
        self.scope = scope
        self.api = api
        self.session = session
        coordinator = HomePostalCoordinator(scope: scope, store: store, transport: APIHomePostalTransport(api: api)) {
            try session.requireCurrent()
        }
    }

    static func live(homeId: String, api: APIClient = .shared) -> HomePostalViewModel {
        let auth = api.authProvider ?? AuthManager.shared
        let actor: String = if case let .signedIn(user) = auth.state { user.id } else { "" }
        return HomePostalViewModel(
            scope: HomePostalScope(origin: api.apiBaseURL.absoluteString, actorId: actor, homeId: homeId.lowercased()),
            api: api,
            session: HomeClaimSessionScope(api: api),
            store: PendingHomePostalStore()
        )
    }

    var homeId: String {
        scope.homeId
    }

    var isCurrent: Bool {
        session.isCurrent && scope.isValid
    }

    var pending: PendingHomePostalCommand? {
        visible && isCurrent ? coordinator.pending : nil
    }

    var outcome: HomePostalOutcome? {
        visible && isCurrent ? coordinator.outcome : nil
    }

    var storageFailed: Bool {
        coordinator.storageFailed
    }

    var canAcknowledge: Bool {
        !isWorking && pending?.outcome?.isTerminal == true && !storageFailed
    }

    var canRequestMail: Bool {
        ready && status?.canRequest == true && HomePostalValidation.address(address.body) != nil
    }

    var canResumeMail: Bool {
        ready && status?.canResume == true
    }

    var canVerifyCode: Bool {
        ready && status?.canVerify == true && codeInput.range(of: "^[a-zA-Z0-9]{6,8}$", options: .regularExpression) != nil
    }

    private var ready: Bool {
        visible && isCurrent && opened && !isWorking && pending == nil && !storageFailed
    }

    func suspend() {
        generation += 1
        visible = false
        isWorking = false
        opened = false
        status = nil
        progress = nil
        address = HomePostalAddressForm()
        codeInput = ""
        error = nil
        coordinator.hide()
    }

    func open() async {
        guard !isWorking else { return }
        visible = true
        guard isCurrent else { error = HomePostalError.sessionChanged.localizedDescription
            return
        }
        let revision = generation
        isWorking = true
        error = nil
        status = nil
        progress = nil
        defer { if current(revision) { isWorking = false } }
        do {
            try coordinator.restore()
            opened = true
            if coordinator.pending != nil {
                _ = try await coordinator.resolve(.check)
            } else {
                try await loadCurrent(revision)
            }
        } catch { show(error, revision: revision) }
    }

    func refresh() async {
        guard ready else { await open()
            return
        }
        await perform { revision in try await self.loadCurrent(revision) }
    }

    func requestMail() async {
        guard canRequestMail else { return }
        let selected = address.body
        await perform { _ in
            self.status = nil
            self.progress = nil
            try self.coordinator.prepareMail(address: selected)
            _ = try await self.coordinator.resolve(.submit)
        }
    }

    func resumeMail() async {
        guard canResumeMail, let original = status?.originalRequest, let address = original["address"],
              let requestId = original["command"]?.dictValue?["request_id"]?.stringValue else { return }
        await perform { _ in
            self.status = nil
            self.progress = nil
            try self.coordinator.prepareMail(address: address, originalRequestId: requestId)
            _ = try await self.coordinator.resolve(.submit)
        }
    }

    func verifyCode() async {
        guard canVerifyCode, let postcardId = status?.postcard?["id"]?.stringValue else { return }
        let code = codeInput
        codeInput = ""
        await perform { _ in
            self.status = nil
            self.progress = nil
            try self.coordinator.prepareCode(code, postcardId: postcardId)
            _ = try await self.coordinator.resolve(.submit)
        }
    }

    func recover(_ action: HomePostalAction) async {
        guard pending != nil else { await open()
            return
        }
        await perform { _ in _ = try await self.coordinator.resolve(action) }
    }

    func acknowledge() async {
        guard canAcknowledge else { return }
        await perform { revision in
            let original = try self.coordinator.acknowledge()
            self.codeInput = ""
            if let address = HomePostalValidation.address(original.body.dictValue?["address"]) {
                self.address = HomePostalAddressForm(address)
            }
            try await self.loadCurrent(revision)
        }
    }

    func permits(_ destination: HomePostalNavigation) -> Bool {
        guard ready, let progress else { return false }
        switch destination {
        case .home: return progress.nextStep == .home && progress.currentAccess == "shared"
        case .residency: return true
        case .ownership: return progress.nextStep == .ownershipVerification
        case .addHome: return progress.nextStep == .resubmit
        }
    }

    private func current(_ revision: Int) -> Bool {
        visible && generation == revision && isCurrent
    }

    private func loadCurrent(_ revision: Int) async throws {
        status = nil
        progress = nil
        let raw: JSONValue = try await api.request(Endpoint(
            method: .get, path: "/api/homes/\(homeId)/postcard-status", cachePolicy: .reloadIgnoringLocalCacheData
        ))
        guard current(revision), !Task.isCancelled else { throw HomePostalError.sessionChanged }
        let postal = HomePostalStatus(value: raw)
        guard postal.matches(scope) else { throw HomePostalError.unavailable }
        let residency: PersonalHomeResidencyProgress = try await api.request(Endpoint(
            method: .get, path: "/api/homes/\(homeId)/my-residency", cachePolicy: .reloadIgnoringLocalCacheData
        ))
        guard current(revision), !Task.isCancelled else { throw HomePostalError.sessionChanged }
        guard residency.matches(homeId) else { throw HomePostalError.unavailable }
        status = postal
        progress = residency
    }

    private func perform(_ action: (Int) async throws -> Void) async {
        guard visible, isCurrent, !isWorking else { return }
        let revision = generation
        isWorking = true
        error = nil
        defer { if current(revision) { isWorking = false } }
        do { try await action(revision) } catch { show(error, revision: revision) }
    }

    private func show(_ failure: Error, revision: Int) {
        guard current(revision) else { return }
        error = (failure as? HomePostalError)?.localizedDescription ?? HomePostalError.unavailable.localizedDescription
    }
}
