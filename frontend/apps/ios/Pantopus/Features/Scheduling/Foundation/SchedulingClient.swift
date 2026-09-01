//
//  SchedulingClient.swift
//  Pantopus
//
//  Foundation (I0b) — an optional thin convenience over `APIClient` that maps a
//  thrown `APIError` to the typed `SchedulingError` (so callers get parsed 409
//  `alternatives` / validation `details` / first-class states for free).
//  Feature streams may use this or call `APIClient` directly. Internal because
//  it wraps the internal `APIClient`.
//

import Foundation

/// Convenience wrapper that re-maps `APIError` to `SchedulingError`. Owner
/// context is supplied by the endpoint builders (`SchedulingEndpoints`), so this
/// only needs to fold error handling.
struct SchedulingClient {
    static let shared = SchedulingClient(client: .shared)

    private let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    /// Perform a request and decode `Response`, re-mapping failures to
    /// `SchedulingError`.
    func request<Response: Decodable>(
        _ endpoint: Endpoint,
        as _: Response.Type = Response.self
    ) async throws -> Response {
        do {
            return try await client.request(endpoint)
        } catch let error as APIError {
            throw SchedulingError.from(error)
        }
    }

    /// Perform a no-body request, re-mapping failures to `SchedulingError`.
    @discardableResult
    func send(_ endpoint: Endpoint) async throws -> EmptyResponse {
        do {
            return try await client.request(endpoint)
        } catch let error as APIError {
            throw SchedulingError.from(error)
        }
    }

    /// Fetch a raw artifact (e.g. an `.ics`), re-mapping failures.
    func data(_ endpoint: Endpoint) async throws -> Data {
        do {
            return try await client.requestData(endpoint)
        } catch let error as APIError {
            throw SchedulingError.from(error)
        }
    }
}
