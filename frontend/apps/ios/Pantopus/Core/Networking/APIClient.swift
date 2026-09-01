//
//  APIClient.swift
//  Pantopus
//
//  Async/await HTTP client with typed errors, ETag-aware response caching,
//  and exponential-backoff retry for idempotent GETs. Every feature
//  accesses the backend through this — no direct `URLSession.shared` in
//  feature code.
//

import Foundation
import Logging

/// Pantopus's HTTP client. Owns a dedicated `URLSession` with on-disk
/// caching; emits typed `APIError` values; retries transient failures on
/// idempotent methods.
@Observable
final class APIClient: @unchecked Sendable {
    /// Singleton for the live app. Unit tests construct their own
    /// instance. Under `UI_TESTS_STUB_API=1` the lazy initializer wires
    /// in `UITestStubProtocol` so XCUITests can drive the network surface
    /// without a real backend.
    static let shared: APIClient = {
        #if DEBUG
        if ProcessInfo.processInfo.environment["UI_TESTS_STUB_API"] == "1" {
            return APIClient.makeUITestStubbed()
        }
        #endif
        return APIClient()
    }()

    #if DEBUG
    /// Build an `APIClient` whose `URLSession` routes every request
    /// through `UITestStubProtocol`. Only used by UI-test launches.
    private static func makeUITestStubbed() -> APIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [UITestStubProtocol.self]
        config.urlCache = nil
        config.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        return APIClient(
            session: URLSession(configuration: config),
            retryPolicy: .none
        )
    }
    #endif

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private let logger = Logger(label: "app.pantopus.ios.APIClient")
    private let environment: AppEnvironment
    private let retryPolicy: RetryPolicy

    /// - Parameters:
    ///   - environment: API target + base URL.
    ///   - session: Inject a custom session for tests. Defaults to a
    ///     URLCache-backed session sized 10MB / 50MB (memory / disk).
    ///   - retryPolicy: Retry configuration.
    init(
        environment: AppEnvironment = .current,
        session: URLSession? = nil,
        retryPolicy: RetryPolicy = .default
    ) {
        self.environment = environment
        self.retryPolicy = retryPolicy

        if let session {
            self.session = session
        } else {
            let config = URLSessionConfiguration.default
            // ETag-aware cache — URLSession honours Cache-Control, ETag, and
            // If-None-Match automatically when the policy allows it. Feature
            // code can override per-request via `Endpoint.cachePolicy`.
            let cache = URLCache(
                memoryCapacity: 10 * 1024 * 1024,
                diskCapacity: 50 * 1024 * 1024,
                diskPath: "pantopus-http"
            )
            config.urlCache = cache
            config.requestCachePolicy = .useProtocolCachePolicy
            config.timeoutIntervalForRequest = 20
            config.timeoutIntervalForResource = 60
            self.session = URLSession(configuration: config)
        }

        let decoder = JSONDecoder()
        // We do NOT set `convertFromSnakeCase` globally — many DTOs mix
        // snake_case and camelCase in the same response, so per-field
        // `CodingKeys` are the source of truth.
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        self.encoder = encoder
    }

    // MARK: - Public API

    /// Perform a request and decode the response body as `Response`.
    func request<Response: Decodable>(
        _ endpoint: Endpoint,
        as _: Response.Type = Response.self
    ) async throws -> Response {
        let data = try await executeWithRetry(endpoint)
        if Response.self == EmptyResponse.self, data.isEmpty {
            // swiftlint:disable:next force_cast
            return EmptyResponse() as! Response
        }
        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            logger.error(
                "Decode error for \(endpoint.path)",
                metadata: ["error": .string("\(error)")]
            )
            await Observability.shared.capture(error)
            throw APIError.decoding(underlying: error)
        }
    }

    /// Void convenience. Throws on non-2xx; returns `EmptyResponse` otherwise.
    @discardableResult
    func request(_ endpoint: Endpoint) async throws -> EmptyResponse {
        try await request(endpoint, as: EmptyResponse.self)
    }

    /// Perform a request and return the raw response body — for binary
    /// artifacts (e.g. the residency-letter PDF), not JSON.
    func requestData(_ endpoint: Endpoint) async throws -> Data {
        try await executeWithRetry(endpoint)
    }

    /// `Result`-returning variant for call sites that prefer explicit
    /// handling over `try`.
    func perform<Response: Decodable>(
        _ endpoint: Endpoint,
        as type: Response.Type = Response.self
    ) async -> APIResult<Response> {
        do {
            return try await .success(request(endpoint, as: type))
        } catch let error as APIError {
            return .failure(error)
        } catch {
            return .failure(.decoding(underlying: error))
        }
    }

    // MARK: - Push token (unchanged from Prompt P1)

    func registerPushToken(_ token: String, platform: String) async {
        do {
            try await request(
                Endpoint(
                    method: .post,
                    path: "/api/notifications/register",
                    body: ["token": token, "platform": platform]
                )
            )
        } catch {
            logger.warning(
                "Push token registration failed",
                metadata: ["error": .string("\(error)")]
            )
        }
    }

    // MARK: - Retry loop

    private func executeWithRetry(_ endpoint: Endpoint) async throws -> Data {
        let shouldRetry = endpoint.method.isIdempotent
        var attempt = 0
        // One silent token refresh per request. On a 401 for an authenticated
        // call we ask AuthManager to refresh (single-flight) and replay once
        // with the new token; only if that fails do we sign out. Refresh is
        // attempted regardless of HTTP method — a 401 is rejected at the auth
        // middleware before any side effect, so replaying is safe.
        var didAttemptRefresh = false
        while true {
            // Rebuild each iteration so a refreshed access token is picked up.
            let request = try await buildRequest(for: endpoint)
            do {
                return try await executeOnce(request, endpoint: endpoint)
            } catch let error as APIError {
                switch error {
                case .unauthorized where endpoint.authenticated && !didAttemptRefresh:
                    didAttemptRefresh = true
                    switch await AuthManager.shared.refreshIfPossible() {
                    case .rotated:
                        continue
                    case .authRejected:
                        // Refresh token expired/revoked — end the session.
                        await AuthManager.shared.handleUnauthorized()
                        throw error
                    case .transient:
                        // Couldn't refresh due to a network/server blip. Do NOT
                        // sign out — surface a transport error so callers (and
                        // session restore) keep the session and can retry.
                        throw APIError.transport(underlying: URLError(.networkConnectionLost))
                    }
                case .unauthorized:
                    // Unauthenticated endpoint (login/refresh/…) or refresh
                    // already tried and the replay still 401'd.
                    if endpoint.authenticated {
                        await AuthManager.shared.handleUnauthorized()
                    }
                    throw error
                default:
                    if !shouldRetry || !error.isTransient || attempt >= retryPolicy.maxRetries {
                        throw error
                    }
                    attempt += 1
                    let delay = retryPolicy.delay(forAttempt: attempt)
                    logger.info(
                        "Retry \(attempt)/\(self.retryPolicy.maxRetries) after \(Int(delay * 1000))ms for \(endpoint.path)"
                    )
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                }
            }
        }
    }

    private func executeOnce(_ request: URLRequest, endpoint: Endpoint) async throws -> Data {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError {
            throw APIError.transport(underlying: error)
        } catch {
            throw APIError.invalidResponse
        }
        // An endpoint that opts out of the protocol cache must not leave a
        // copy behind either: `URLRequest.CachePolicy` only governs *reads*,
        // so CFNetwork still heuristically writes a 200 GET with no
        // `Cache-Control` into the on-disk `pantopus-http` cache. Sensitive
        // reads (e.g. the business private record — legal name, tax id) rely
        // on this purge, so the bytes never outlive the request.
        if endpoint.cachePolicy != .useProtocolCachePolicy {
            session.configuration.urlCache?.removeCachedResponse(for: request)
        }
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        logger.debug("API \(endpoint.method.rawValue) \(endpoint.path) -> \(http.statusCode)")
        warnIfResponseExceedsBudget(path: endpoint.path, byteCount: data.count)

        switch http.statusCode {
        case 200..<300, 304:
            return data
        case 401:
            // Refresh + sign-out decisions are made in executeWithRetry.
            throw APIError.unauthorized
        case 403: throw APIError.forbidden
        case 404: throw APIError.notFound
        case 400..<500:
            let message = String(data: data, encoding: .utf8)
            throw APIError.clientError(status: http.statusCode, message: message)
        default:
            await Observability.shared.capture(
                message: "API \(endpoint.method.rawValue) \(endpoint.path) -> \(http.statusCode)",
                level: .error
            )
            let body = String(data: data, encoding: .utf8) ?? ""
            throw APIError.server(status: http.statusCode, body: body)
        }
    }

    // MARK: - Building requests

    private func buildRequest(for endpoint: Endpoint) async throws -> URLRequest {
        guard var components = URLComponents(
            url: environment.apiBaseURL.appendingPathComponent(endpoint.path),
            resolvingAgainstBaseURL: false
        ) else {
            throw APIError.invalidURL
        }
        if !endpoint.query.isEmpty {
            components.queryItems = endpoint.query
                .sorted { $0.key < $1.key }
                .map { URLQueryItem(name: $0.key, value: $0.value) }
            // URLComponents leaves "+" bare in query values (legal per RFC
            // 3986), but Express decodes bare "+" as a space — which
            // corrupts ISO-8601 cursor timestamps like "…+00:00". Encode
            // it explicitly so the backend sees the literal plus.
            components.percentEncodedQuery = components.percentEncodedQuery?
                .replacingOccurrences(of: "+", with: "%2B")
        }
        guard let url = components.url else { throw APIError.invalidURL }

        var request = URLRequest(url: url, cachePolicy: endpoint.cachePolicy)
        if let timeout = endpoint.timeout {
            request.timeoutInterval = timeout
        }
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(
            "ios-\(Bundle.main.appVersion)",
            forHTTPHeaderField: "X-Client-Platform"
        )
        for (key, value) in endpoint.headers {
            request.setValue(value, forHTTPHeaderField: key)
        }

        if endpoint.authenticated, let token = await AuthManager.shared.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = endpoint.body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }

        return request
    }

    // MARK: - Response-size budgets (P13)

    /// Hot read endpoints whose response should stay under the
    /// per-request size budget. Anything larger trips a warn-level log
    /// and (when wired in P15) a Sentry breadcrumb so we catch
    /// regressions before they ship.
    private static let responseSizeWatchPaths: [String] = [
        "/api/hub",
        "/api/mailbox",
        "/api/homes/my-homes"
    ]

    /// Per-path size budget in bytes (500 KB).
    private static let responseSizeBudgetBytes: Int = 500_000

    /// Log a warning when a watched endpoint exceeds the size budget.
    /// Called from `executeOnce` after a successful 2xx so retries don't
    /// double-count.
    private func warnIfResponseExceedsBudget(path: String, byteCount: Int) {
        guard byteCount > Self.responseSizeBudgetBytes else { return }
        let watched = Self.responseSizeWatchPaths.contains { path.hasPrefix($0) }
        guard watched else { return }
        let kib = byteCount / 1024
        logger.warning(
            "API response size budget exceeded for \(path): \(kib) KB > 500 KB"
        )
    }
}

// MARK: - Endpoint

/// A fully-described outbound HTTP call. Prefer the feature-scoped helpers
/// in `Networking/Endpoints/` over constructing this by hand.
public struct Endpoint: Sendable {
    public enum Method: String, Sendable {
        case get = "GET"
        case post = "POST"
        case put = "PUT"
        case patch = "PATCH"
        case delete = "DELETE"

        /// Only idempotent methods are retried by the client.
        public var isIdempotent: Bool {
            self == .get || self == .put || self == .delete
        }
    }

    public let method: Method
    public let path: String
    public let query: [String: String]
    public let body: (any Encodable & Sendable)?
    public let headers: [String: String]
    public let authenticated: Bool
    public let cachePolicy: URLRequest.CachePolicy
    /// Per-request override of the session's 20s inactivity timeout.
    /// Use for slow single-shot endpoints (e.g. AI vision drafts allow
    /// 30s server-side).
    public let timeout: TimeInterval?

    public init(
        method: Method,
        path: String,
        query: [String: String] = [:],
        body: (any Encodable & Sendable)? = nil,
        headers: [String: String] = [:],
        authenticated: Bool = true,
        cachePolicy: URLRequest.CachePolicy = .useProtocolCachePolicy,
        timeout: TimeInterval? = nil
    ) {
        self.method = method
        self.path = path
        self.query = query
        self.body = body
        self.headers = headers
        self.authenticated = authenticated
        self.cachePolicy = cachePolicy
        self.timeout = timeout
    }
}

// MARK: - Retry policy

/// Exponential-backoff retry policy with jitter.
public struct RetryPolicy: Sendable {
    public let maxRetries: Int
    public let baseDelay: TimeInterval
    public let maxDelay: TimeInterval

    public init(maxRetries: Int, baseDelay: TimeInterval, maxDelay: TimeInterval) {
        self.maxRetries = maxRetries
        self.baseDelay = baseDelay
        self.maxDelay = maxDelay
    }

    /// 2 retries, 300ms base → ~300ms + 900ms (both with ±20% jitter).
    public static let `default` = RetryPolicy(
        maxRetries: 2,
        baseDelay: 0.300,
        maxDelay: 5.0
    )

    /// No retries; used from tests that want to assert single-shot behaviour.
    public static let none = RetryPolicy(maxRetries: 0, baseDelay: 0, maxDelay: 0)

    /// Compute the delay before attempt `attempt` (1-indexed).
    public func delay(forAttempt attempt: Int) -> TimeInterval {
        let exponential = baseDelay * pow(3.0, Double(attempt - 1))
        let capped = min(exponential, maxDelay)
        let jitter = Double.random(in: 0.8...1.2)
        return capped * jitter
    }
}

// MARK: - Helpers

/// Empty response sentinel for endpoints that return no body.
public struct EmptyResponse: Decodable, Sendable {
    public init() {}
}

/// Erases any `Encodable` into something JSONEncoder can handle when we
/// only know the concrete type at the call site.
struct AnyEncodable: Encodable, @unchecked Sendable {
    private let encodeClosure: (any Encoder) throws -> Void
    init(_ wrapped: some Encodable) {
        encodeClosure = wrapped.encode
    }

    func encode(to encoder: any Encoder) throws {
        try encodeClosure(encoder)
    }
}

private extension Bundle {
    var appVersion: String {
        (infoDictionary?["CFBundleShortVersionString"] as? String) ?? "0.0.0"
    }
}
