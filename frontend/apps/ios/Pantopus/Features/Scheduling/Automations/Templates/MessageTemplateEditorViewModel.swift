//
//  MessageTemplateEditorViewModel.swift
//  Pantopus
//
//  Stream I16 — H5 Message Template Editor. Writes a reusable message template:
//  a channel, an optional subject (required for email), and a body with
//  `{{variable}}` insertion + H7 preview. New templates POST; existing ones PUT
//  (`/message-templates`). There is no GET-single route, so editing loads the
//  list and finds the row. SMS over 160 characters warns it sends as more than
//  one. Owner-polymorphic via `SchedulingOwner`.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class MessageTemplateEditorViewModel {
    enum Phase: Equatable { case loading, loaded, error(String) }

    // MARK: Inputs

    let owner: SchedulingOwner
    let templateId: String?
    private let client: SchedulingClient

    // MARK: Editable fields

    var name = ""
    var channel: WorkflowChannel = .email
    var subject = ""
    var body = ""
    /// Mirrors the backend `is_active` field. Defaults `true` for new templates.
    var isActive = true

    // MARK: UI state

    private(set) var phase: Phase = .loading
    var showVariablePicker = false
    var showPreview = false
    private(set) var isSaving = false
    var saveError: String?
    private(set) var didAttemptSave = false
    var showDeleteConfirm = false
    private(set) var isDeleting = false
    var deleteError: String?

    var isNew: Bool {
        templateId == nil
    }

    var navTitle: String {
        isNew ? "New template" : "Edit template"
    }

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

    var showsSubject: Bool {
        channel == .email || channel == .sms
    }

    var subjectRequired: Bool {
        channel == .email
    }

    private var trimmedName: String {
        name.trimmingCharacters(in: .whitespaces)
    }

    private var trimmedBody: String {
        body.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var trimmedSubject: String {
        subject.trimmingCharacters(in: .whitespaces)
    }

    var nameIsEmpty: Bool {
        trimmedName.isEmpty
    }

    var bodyIsEmpty: Bool {
        trimmedBody.isEmpty
    }

    var subjectMissing: Bool {
        subjectRequired && trimmedSubject.isEmpty
    }

    var canSave: Bool {
        !nameIsEmpty && !bodyIsEmpty && !subjectMissing && !isSaving
    }

    var canPreview: Bool {
        !bodyIsEmpty
    }

    var bodyCount: Int {
        body.count
    }

    var counterLimit: Int {
        channel == .sms ? WorkflowChannel.smsSegmentLimit : WorkflowChannel.bodyCounterLimit
    }

    var isOverLimit: Bool {
        channel == .sms && bodyCount > WorkflowChannel.smsSegmentLimit
    }

    init(
        owner: SchedulingOwner,
        templateId: String?,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.templateId = templateId
        self.client = client
    }

    // MARK: Lifecycle

    func load() async {
        guard let templateId else { phase = .loaded
            return
        }
        if case .loaded = phase {} else { phase = .loading }
        do {
            let response: MessageTemplatesResponse = try await client.request(SchedulingEndpoints.getMessageTemplates(owner: owner))
            guard let template = response.templates.first(where: { $0.id == templateId }) else {
                phase = .error("This template couldn't be found. It may have been deleted.")
                return
            }
            name = template.name
            channel = WorkflowChannel(wire: template.channel)
            subject = template.subject ?? ""
            body = template.body
            isActive = template.isActive ?? true
            phase = .loaded
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load this template.")
        } catch {
            phase = .error("Couldn't load this template.")
        }
    }

    // MARK: Editing

    func setChannel(_ channel: WorkflowChannel) {
        guard !channel.isComingSoon else { return }
        self.channel = channel
    }

    func insert(variable: TemplateVariable) {
        if !body.isEmpty, !body.hasSuffix(" "), !body.hasSuffix("\n") { body += " " }
        body += variable.token
        showVariablePicker = false
    }

    var previewSubject: String? {
        showsSubject && !trimmedSubject.isEmpty ? subject : nil
    }

    // MARK: Save

    func save() async -> Bool {
        didAttemptSave = true
        guard !nameIsEmpty, !bodyIsEmpty, !subjectMissing, !isSaving else { return false }
        isSaving = true
        saveError = nil
        defer { isSaving = false }
        let subjectValue = trimmedSubject.isEmpty ? nil : subject
        do {
            if let templateId {
                _ = try await client.request(
                    SchedulingEndpoints.updateMessageTemplate(owner: owner, id: templateId, UpdateMessageTemplateRequest(
                        name: name,
                        channel: channel.rawValue,
                        subject: subjectValue,
                        body: body,
                        isActive: isActive
                    )),
                    as: MessageTemplateResponse.self
                )
            } else {
                _ = try await client.request(
                    SchedulingEndpoints.createMessageTemplate(owner: owner, CreateMessageTemplateRequest(
                        name: name,
                        body: body,
                        channel: channel.rawValue,
                        subject: subjectValue,
                        isActive: isActive
                    )),
                    as: MessageTemplateResponse.self
                )
            }
            return true
        } catch let error as SchedulingError {
            saveError = Self.message(for: error)
            return false
        } catch {
            saveError = "Couldn't save this template. Try again."
            return false
        }
    }

    // MARK: Delete

    /// Deletes the current template. Returns `true` on success so the view can dismiss.
    func delete() async -> Bool {
        guard let templateId, !isDeleting else { return false }
        isDeleting = true
        deleteError = nil
        defer { isDeleting = false }
        do {
            _ = try await client.request(
                SchedulingEndpoints.deleteMessageTemplate(owner: owner, id: templateId),
                as: SchedulingOkResponse.self
            )
            return true
        } catch let error as SchedulingError {
            deleteError = error.userMessage ?? "Couldn't delete this template. Try again."
            return false
        } catch {
            deleteError = "Couldn't delete this template. Try again."
            return false
        }
    }

    private static func message(for error: SchedulingError) -> String {
        switch error {
        case .forbidden: "Only admins can edit templates here."
        case let .validation(_, details): details.first?.message ?? "Check the highlighted fields and try again."
        default: error.userMessage ?? "Couldn't save this template. Try again."
        }
    }
}
