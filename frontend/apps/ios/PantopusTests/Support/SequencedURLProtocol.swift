//
//  SequencedURLProtocol.swift
//  PantopusTests
//
//  URLProtocol stub that pops one canned response per request from a FIFO
//  sequence — designed for retry tests where the client sees a different
//  response on each attempt.
//

import Foundation

final class SequencedURLProtocol: URLProtocol {
    struct Response {
        let status: Int
        let body: Data
        let headers: [String: String]
        let delay: TimeInterval

        static func status(
            _ code: Int,
            body: String,
            headers: [String: String] = [:],
            delay: TimeInterval = 0
        ) -> Response {
            Response(status: code, body: Data(body.utf8), headers: headers, delay: delay)
        }
    }

    nonisolated(unsafe) static var sequence: [Response] = []
    nonisolated(unsafe) static var routeResponses: [String: [Response]] = [:]
    nonisolated(unsafe) static var capturedRequests: [URLRequest] = []
    private nonisolated(unsafe) static var sessionRouteResponses: [String: [String: [Response]]] = [:]

    private static let lock = NSLock()
    private static let sessionHeader = "X-Pantopus-Test-Session"

    static func reset() {
        lock.lock()
        defer { lock.unlock() }
        sequence = []
        routeResponses = [:]
        capturedRequests = []
        sessionRouteResponses = [:]
    }

    static func makeSession() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [SequencedURLProtocol.self]
        config.urlCache = nil
        return URLSession(configuration: config)
    }

    static func makeSession(routeResponses routes: [String: [Response]]) -> URLSession {
        let sessionId = UUID().uuidString
        lock.lock()
        sessionRouteResponses[sessionId] = routes
        lock.unlock()

        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [SequencedURLProtocol.self]
        config.httpAdditionalHeaders = [sessionHeader: sessionId]
        config.urlCache = nil
        return URLSession(configuration: config)
    }

    override static func canInit(with _: URLRequest) -> Bool {
        true
    }

    override static func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func stopLoading() {}

    override func startLoading() {
        let response = Self.nextResponse(for: request)
        if response.delay > 0 {
            Thread.sleep(forTimeInterval: response.delay)
        }

        guard let url = request.url,
              let http = HTTPURLResponse(
                  url: url,
                  statusCode: response.status,
                  httpVersion: "HTTP/1.1",
                  headerFields: response.headers
              )
        else { return }
        client?.urlProtocol(self, didReceive: http, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: response.body)
        client?.urlProtocolDidFinishLoading(self)
    }

    private static func nextResponse(for request: URLRequest) -> Response {
        lock.lock()
        defer { lock.unlock() }
        capturedRequests.append(request)
        if let response = nextSessionResponse(for: request) {
            return response
        }
        if let key = routeKey(for: request),
           var responses = routeResponses[key],
           !responses.isEmpty {
            let response = responses.removeFirst()
            routeResponses[key] = responses
            return response
        }
        if let path = request.url?.path,
           var responses = routeResponses[path],
           !responses.isEmpty {
            let response = responses.removeFirst()
            routeResponses[path] = responses
            return response
        }
        if sequence.isEmpty {
            return Response.status(599, body: "{\"error\":\"no stubbed response\"}")
        }
        return sequence.removeFirst()
    }

    private static func nextSessionResponse(for request: URLRequest) -> Response? {
        guard let sessionId = request.value(forHTTPHeaderField: sessionHeader),
              var routes = sessionRouteResponses[sessionId] else { return nil }
        let keys = [routeKey(for: request), request.url?.path].compactMap { $0 }
        for key in keys {
            guard var responses = routes[key], !responses.isEmpty else { continue }
            let response = responses.removeFirst()
            routes[key] = responses
            sessionRouteResponses[sessionId] = routes
            return response
        }
        return Response.status(599, body: "{\"error\":\"no stubbed response\"}")
    }

    private static func routeKey(for request: URLRequest) -> String? {
        guard let url = request.url else { return nil }
        guard let query = url.query, !query.isEmpty else { return url.path }
        return "\(url.path)?\(query)"
    }
}
