//
//  WorkflowEditorViewModel.swift
//  Pantopus
//
//  Stream I16 — H3 Workflow Editor. Builds or edits one automation: a trigger
//  (lifecycle + optional before/after offset, refined in the H4 Trigger Picker),
//  an action channel (email / push / in-app / SMS — SMS disabled "coming soon"),
//  and a message body (with {{variable}} insertion + H7 preview), plus an active
//  toggle. Maps 1:1 to `SchedulingWorkflow`: there is no separate recipient field
//  on the backend, so the channel carries the audience (email/SMS → attendees,
//  push/in-app → you). New workflows POST; existing ones PUT. There is no
//  GET-single route, so editing loads the list and finds the row.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class WorkflowEditorViewModel {
    enum Phase: Equatable { case loading, loaded, error(String) }
    enum Tab: Int, CaseIterable { case build, activity }

    // MARK: Inputs

    let owner: SchedulingOwner
    let workflowId: String?
    private let client: SchedulingClient

    // MARK: Editable fields

    var trigger: WorkflowTrigger = .beforeStart
    var offsetMinutes = 60
    var channel: WorkflowChannel = .email
    var message = ""
    var name = ""
    var isActive = true

    // MARK: UI state

    private(set) var phase: Phase = .loading
    var tab: Tab = .build
    var showTriggerPicker = false
    var showVariablePicker = false
    var showPreview = false
    private(set) var isSaving = false
    var saveError: String?
    /// Set true once the user attempts to save with an empty message.
    private(set) var didAttemptSave = false
    var showDeleteConfirm = false
    private(set) var isDeleting = false
    var deleteError: String?

    var isNew: Bool {
        workflowId == nil
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

    var navTitle: String {
        isNew ? "New workflow" : "Edit workflow"
    }

    /// Channel-implied audience caption (no backend recipient field).
    var recipientCaption: String {
        switch channel {
        case .email, .sms: "Sends to your attendees"
        case .push, .inApp: "Notifies you"
        }
    }

    var trimmedMessage: String {
        message.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var messageIsEmpty: Bool {
        trimmedMessage.isEmpty
    }

    var canSave: Bool {
        !messageIsEmpty && !isSaving
    }

    var canPreview: Bool {
        !messageIsEmpty
    }

    /// Body character count for the live counter.
    var messageCount: Int {
        message.count
    }

    var counterLimit: Int {
        channel == .sms ? WorkflowChannel.smsSegmentLimit : WorkflowChannel.bodyCounterLimit
    }

    var isOverLimit: Bool {
        channel == .sms && messageCount > WorkflowChannel.smsSegmentLimit
    }

    /// Resolved name sent to the backend (which requires a non-empty name).
    private var resolvedName: String {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? channel.actionSummary : trimmed
    }

    init(
        owner: SchedulingOwner,
        workflowId: String?,
        client: SchedulingClient
    ) {
        self.owner = owner
        self.workflowId = workflowId
        self.client = client
    }

    // MARK: Lifecycle

    func load() async {
        guard let workflowId else {
            // New workflow — sensible preset: 1 hour before · Email.
            phase = .loaded
            return
        }
        if case .loaded = phase {} else { phase = .loading }
        do {
            let response: WorkflowsResponse = try await client.request(SchedulingEndpoints.getWorkflows(owner: owner))
            guard let workflow = response.workflows.first(where: { $0.id == workflowId }) else {
                phase = .error("This workflow couldn't be found. It may have been deleted.")
                return
            }
            apply(workflow)
            phase = .loaded
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load this workflow.")
        } catch {
            phase = .error("Couldn't load this workflow.")
        }
    }

    private func apply(_ workflow: WorkflowDTO) {
        trigger = WorkflowTrigger(wire: workflow.trigger)
        offsetMinutes = max(0, workflow.offsetMinutes ?? 0)
        if offsetMinutes == 0, trigger.usesOffset { offsetMinutes = 60 }
        channel = WorkflowChannel(wire: workflow.action)
        message = workflow.messageTemplate ?? ""
        name = workflow.name
        isActive = workflow.isActive ?? true
    }

    // MARK: Editing

    func setChannel(_ channel: WorkflowChannel) {
        guard !channel.isComingSoon else { return }
        self.channel = channel
    }

    func applyTrigger(_ trigger: WorkflowTrigger, offsetMinutes: Int) {
        self.trigger = trigger
        self.offsetMinutes = trigger.usesOffset ? max(0, offsetMinutes) : 0
        showTriggerPicker = false
    }

    func insert(variable: TemplateVariable) {
        if !message.isEmpty, !message.hasSuffix(" "), !message.hasSuffix("\n") { message += " " }
        message += variable.token
        showVariablePicker = false
    }

    /// Draft routed into the local preview sheet (workflows have no subject).
    var previewDraft: MessagePreviewDraft {
        MessagePreviewDraft(subject: nil, body: message, channel: channel)
    }

    // MARK: Save

    func save() async -> Bool {
        didAttemptSave = true
        guard !messageIsEmpty else { return false }
        guard !isSaving else { return false }
        isSaving = true
        saveError = nil
        defer { isSaving = false }
        let offset = trigger.usesOffset ? offsetMinutes : 0
        do {
            if let workflowId {
                _ = try await client.request(
                    SchedulingEndpoints.updateWorkflow(owner: owner, id: workflowId, UpdateWorkflowRequest(
                        name: resolvedName,
                        trigger: trigger.rawValue,
                        offsetMinutes: offset,
                        action: channel.rawValue,
                        messageTemplate: message,
                        isActive: isActive
                    )),
                    as: WorkflowResponse.self
                )
            } else {
                _ = try await client.request(
                    SchedulingEndpoints.createWorkflow(owner: owner, CreateWorkflowRequest(
                        name: resolvedName,
                        trigger: trigger.rawValue,
                        action: channel.rawValue,
                        eventTypeId: nil,
                        offsetMinutes: offset,
                        messageTemplate: message,
                        isActive: isActive
                    )),
                    as: WorkflowResponse.self
                )
            }
            return true
        } catch let error as SchedulingError {
            saveError = Self.message(for: error)
            return false
        } catch {
            saveError = "Couldn't save this workflow. Try again."
            return false
        }
    }

    // MARK: Delete

    /// Deletes the current workflow. Returns `true` on success so the view can dismiss.
    func delete() async -> Bool {
        guard let workflowId, !isDeleting else { return false }
        isDeleting = true
        deleteError = nil
        defer { isDeleting = false }
        do {
            _ = try await client.request(
                SchedulingEndpoints.deleteWorkflow(owner: owner, id: workflowId),
                as: SchedulingOkResponse.self
            )
            return true
        } catch let error as SchedulingError {
            deleteError = error.userMessage ?? "Couldn't delete this workflow. Try again."
            return false
        } catch {
            deleteError = "Couldn't delete this workflow. Try again."
            return false
        }
    }

    private static func message(for error: SchedulingError) -> String {
        switch error {
        case .forbidden:
            "Only admins can edit workflows here."
        case let .validation(_, details):
            details.first?.message ?? "Check the highlighted fields and try again."
        default:
            error.userMessage ?? "Couldn't save this workflow. Try again."
        }
    }
}

/// A draft message routed into the H7 preview sheet from an editor.
struct MessagePreviewDraft: Hashable {
    let subject: String?
    let body: String
    let channel: WorkflowChannel
}
