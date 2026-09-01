//
//  MessageTemplateLibraryViewModel.swift
//  Pantopus
//
//  Stream I16 — H8 Message Template Library. Browse + reuse message templates:
//  a read-only "Starter templates" card (client-side seeds the user can
//  duplicate into real rows) and a "My templates" card from
//  `GET /message-templates`. Duplicate seeds/own rows POST a real copy; delete
//  removes a row. New / edit route to the H5 editor. Owner-polymorphic.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class MessageTemplateLibraryViewModel {
    enum Phase: Equatable { case loading, loaded, error(String) }

    // MARK: Inputs

    let owner: SchedulingOwner
    let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    private(set) var templates: [MessageTemplateDTO] = []
    let starters = StarterTemplate.all

    var searchActive = false
    var query = ""
    var deleteTarget: MessageTemplateDTO?
    var actionError: String?
    private(set) var showToast = false
    private(set) var toastText = ""

    // MARK: Derived

    var theme: SchedulingIdentityTheme {
        owner.theme
    }

    var accent: Color {
        theme.accent
    }

    var accentBg: Color {
        theme.accentBg
    }

    private var needle: String {
        query.trimmingCharacters(in: .whitespaces).lowercased()
    }

    var visibleStarters: [StarterTemplate] {
        guard !needle.isEmpty else { return starters }
        return starters.filter { $0.name.lowercased().contains(needle) || $0.body.lowercased().contains(needle) }
    }

    var visibleTemplates: [MessageTemplateDTO] {
        guard !needle.isEmpty else { return templates }
        return templates.filter { $0.name.lowercased().contains(needle) || $0.body.lowercased().contains(needle) }
    }

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.push = push
        self.client = client
    }

    // MARK: Lifecycle

    func load() async {
        if case .loaded = phase {} else { phase = .loading }
        do {
            let response: MessageTemplatesResponse = try await client.request(SchedulingEndpoints.getMessageTemplates(owner: owner))
            templates = response.templates
            phase = .loaded
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load your templates.")
        } catch {
            phase = .error("Couldn't load your templates.")
        }
    }

    func refresh() async {
        await load()
    }

    // MARK: Navigation

    func createNew() {
        push(.messageTemplateEditor(owner: owner, templateId: nil))
    }

    func openTemplate(_ template: MessageTemplateDTO) {
        push(.messageTemplateEditor(owner: owner, templateId: template.id))
    }

    // MARK: Mutations

    func duplicateStarter(_ starter: StarterTemplate) async {
        await mutate(toast: "Added to your templates") {
            CreateMessageTemplateRequest(
                name: starter.name,
                body: starter.body,
                channel: starter.channel.rawValue,
                subject: starter.subject
            )
        }
    }

    func duplicate(_ template: MessageTemplateDTO) async {
        await mutate(toast: "Template duplicated") {
            CreateMessageTemplateRequest(
                name: "\(template.name) (copy)",
                body: template.body,
                channel: template.channel,
                subject: template.subject
            )
        }
    }

    private func mutate(toast: String, _ build: () -> CreateMessageTemplateRequest) async {
        do {
            _ = try await client.request(
                SchedulingEndpoints.createMessageTemplate(owner: owner, build()),
                as: MessageTemplateResponse.self
            )
            await load()
            flashToast(toast)
        } catch let error as SchedulingError {
            actionError = error.userMessage ?? "Something went wrong. Please try again."
        } catch {
            actionError = "Something went wrong. Please try again."
        }
    }

    func confirmDelete() async {
        guard let target = deleteTarget else { return }
        deleteTarget = nil
        do {
            try await client.send(SchedulingEndpoints.deleteMessageTemplate(owner: owner, id: target.id))
            await load()
            flashToast("Template deleted")
        } catch let error as SchedulingError {
            actionError = error.userMessage ?? "Couldn't delete this template."
        } catch {
            actionError = "Couldn't delete this template."
        }
    }

    private func flashToast(_ text: String) {
        toastText = text
        showToast = true
        Task {
            try? await Task.sleep(nanoseconds: 1_700_000_000)
            showToast = false
        }
    }
}
