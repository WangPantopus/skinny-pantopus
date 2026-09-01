//
//  MessagePreviewViewModel.swift
//  Pantopus
//
//  Stream I16 — H7 Message Preview. Renders the resolved message per channel
//  before saving. Drafts come either inline from an editor (subject/body/channel)
//  or from a saved template id (the routed entry — loaded via `GET
//  /message-templates` since there is no GET-single route). Variables are filled
//  by `POST /message-templates/preview` (sample values), with a local
//  interpolation fallback so the mock always renders. There is no send-test
//  endpoint yet, so "Send test" surfaces a coming-soon note honestly.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class MessagePreviewViewModel {
    enum Phase: Equatable { case loading, loaded, error(String) }

    enum Source {
        case draft(subject: String?, body: String, channel: WorkflowChannel)
        case template(id: String)
    }

    // MARK: Inputs

    let owner: SchedulingOwner
    private let source: Source
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    private(set) var filledSubject: String?
    private(set) var filledBody = ""
    private(set) var rawBody = ""
    private(set) var rawSubject: String?
    var activeChannel: WorkflowChannel = .email
    /// Transient note shown under the device mock (e.g. send-test status).
    var testNote: String?
    var testNoteIsError = false

    var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var accent: Color {
        theme.accent
    }

    var accentBg: Color {
        theme.accentBg
    }

    init(owner: SchedulingOwner, source: Source, client: SchedulingClient) {
        self.owner = owner
        self.source = source
        self.client = client
    }

    // MARK: Lifecycle

    func load() async {
        if case .loaded = phase {} else { phase = .loading }
        do {
            let resolved = try await resolveDraft()
            rawSubject = resolved.subject
            rawBody = resolved.body
            activeChannel = resolved.channel
            await fillVariables(subject: resolved.subject, body: resolved.body)
            phase = .loaded
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load this message.")
        } catch {
            phase = .error("Couldn't load this message.")
        }
    }

    // swiftlint:disable:next large_tuple
    private func resolveDraft() async throws -> (subject: String?, body: String, channel: WorkflowChannel) {
        switch source {
        case let .draft(subject, body, channel):
            return (subject, body, channel)
        case let .template(id):
            let response: MessageTemplatesResponse = try await client.request(SchedulingEndpoints.getMessageTemplates(owner: owner))
            guard let template = response.templates.first(where: { $0.id == id }) else {
                throw SchedulingError.notFound(message: "This template couldn't be found.")
            }
            return (template.subject, template.body, WorkflowChannel(wire: template.channel))
        }
    }

    /// Fill `{{tokens}}` via the backend preview; fall back to local
    /// interpolation if the call fails so the mock never renders raw tokens.
    private func fillVariables(subject: String?, body: String) async {
        let samples = TemplateVariableCatalog.sampleValues
        let variables = JSONValue.object(samples.mapValues { JSONValue.string($0) })
        do {
            let response: TemplatePreviewResponse = try await client.request(
                SchedulingEndpoints.previewMessageTemplate(TemplatePreviewRequest(body: body, subject: subject, variables: variables))
            )
            filledSubject = response.subject.map { Self.interpolate($0, with: samples) }
            filledBody = response.body
        } catch {
            filledSubject = subject.map { Self.interpolate($0, with: samples) }
            filledBody = Self.interpolate(body, with: samples)
        }
    }

    static func interpolate(_ template: String, with values: [String: String]) -> String {
        var result = template
        for (key, value) in values {
            result = result.replacingOccurrences(of: "{{\(key)}}", with: value)
        }
        return result
    }

    // MARK: Actions

    func selectChannel(_ index: Int) {
        activeChannel = WorkflowChannel.allCases[index]
    }

    /// No send-test endpoint exists yet — surface a calm coming-soon note.
    func sendTest() {
        testNoteIsError = false
        testNote = "Test sends are coming soon. Save your message to use it."
        Task {
            try? await Task.sleep(nanoseconds: 2_600_000_000)
            testNote = nil
        }
    }
}
