//
//  URLProtocolStub.swift
//  PantopusTests
//
//  Intercepts all requests in tests so URLSession-based clients can be tested
//  without hitting the network. Register with:
//
//      let config = URLSessionConfiguration.ephemeral
//      config.protocolClasses = [URLProtocolStub.self]
//      let session = URLSession(configuration: config)
//

import Foundation

final class URLProtocolStub: URLProtocol {
    struct Response {
        let status: Int
        let body: Data
        let headers: [String: String]

        static func json(_ string: String, status: Int = 200) -> Response {
            Response(
                status: status,
                body: Data(string.utf8),
                headers: ["Content-Type": "application/json"]
            )
        }

        static let empty = Response(status: 204, body: Data(), headers: [:])
    }

    /// Request URL path → canned response. Matched by suffix.
    nonisolated(unsafe) static var stubs: [(pathSuffix: String, responses: [Response])] = []

    /// Captured requests in the order they were made.
    nonisolated(unsafe) static var capturedRequests: [URLRequest] = []

    private static let lock = NSLock()

    static func reset() {
        lock.lock()
        defer { lock.unlock() }
        stubs = []
        capturedRequests = []
    }

    static func stub(path: String, response: Response) {
        stub(path: path, responses: [response])
    }

    static func stub(path: String, responses: [Response]) {
        lock.lock()
        defer { lock.unlock() }
        stubs.append((path, responses))
    }

    // MARK: - URLProtocol

    override static func canInit(with _: URLRequest) -> Bool {
        true
    }

    override static func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func stopLoading() {}

    override func startLoading() {
        let resp = Self.response(for: request)

        guard let url = request.url,
              let httpResponse = HTTPURLResponse(
                  url: url,
                  statusCode: resp.status,
                  httpVersion: "HTTP/1.1",
                  headerFields: resp.headers
              )
        else { return }

        client?.urlProtocol(self, didReceive: httpResponse, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: resp.body)
        client?.urlProtocolDidFinishLoading(self)
    }

    private static func response(for request: URLRequest) -> Response {
        lock.lock()
        defer { lock.unlock() }
        capturedRequests.append(request)

        let path = request.url?.path ?? ""
        if let index = stubs.firstIndex(where: { path.hasSuffix($0.pathSuffix) }) {
            if stubs[index].responses.count > 1 {
                return stubs[index].responses.removeFirst()
            }
            if let response = stubs[index].responses.first {
                return response
            }
        }
        return Response(status: 404, body: Data("{\"error\":\"no stub\"}".utf8), headers: [:])
    }
}

enum TestSession {
    /// Build an ephemeral URLSession with URLProtocolStub installed.
    static func make() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [URLProtocolStub.self]
        return URLSession(configuration: config)
    }
}
