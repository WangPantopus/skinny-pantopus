//
//  WorkflowsListViewModel.swift
//  Pantopus
//
//  Stream I16 — H2 Workflows List. The automations home: a pinned "Default
//  reminders" card (opens the H1 Quick-Setup sheet) plus the owner's workflows
//  (`GET /workflows`), filtered by a Global / This-event-type scope. Each row's
//  iOS toggle flips `is_active` via `PUT /workflows/:id`; a 403 means the caller
//  can view but not edit (Home/Business members), which flips the screen into the
//  read-only gated state honestly. Owner-polymorphic via `SchedulingOwner`.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class WorkflowsListViewModel {
    enum Phase: Equatable { case loading, loaded, error(String) }
    enum Scope: Int, CaseIterable { case global, thisType }

    // MARK: Inputs

    let owner: SchedulingOwner
    let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient

    // MARK: State

    private(set) var phase: Phase = .loading
    private(set) var workflows: [WorkflowDTO] = []
    private(set) var reminderMinutes: [Int] = []
    /// View-only caller (PUT returned 403) → dim toggles, show the lock note.
    private(set) var isGated = false
    /// Transient non-gating mutation failure.
    var actionError: String?
    /// Drives the locally-presented H1 reminders sheet.
    var showRemindersSheet = false

    var scope: Scope = .global
    private var activeOverrides: [String: Bool] = [:]

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

    private var globalWorkflows: [WorkflowDTO] {
        workflows.filter { ($0.eventTypeId ?? "").isEmpty }
    }

    private var scopedWorkflows: [WorkflowDTO] {
        workflows.filter { !($0.eventTypeId ?? "").isEmpty }
    }

    var globalCount: Int {
        globalWorkflows.count
    }

    var scopedCount: Int {
        scopedWorkflows.count
    }

    var visibleWorkflows: [WorkflowDTO] {
        scope == .global ? globalWorkflows : scopedWorkflows
    }

    /// Pinned-card subtitle, e.g. "1 day + 1 hour before · Push".
    var remindersSummary: String {
        AutomationsFormat.remindersSummary(reminderMinutes)
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
            let response: WorkflowsResponse = try await client.request(SchedulingEndpoints.getWorkflows(owner: owner))
            workflows = response.workflows
            activeOverrides.removeAll()
            // Non-fatal: the reminder summary is decorative — a failure leaves it
            // showing "no reminders yet" without blocking the list.
            let page = try? await client.request(SchedulingEndpoints.getBookingPage(owner: owner), as: BookingPageResponse.self)
            reminderMinutes = page?.page.reminderMinutes ?? []
            phase = .loaded
        } catch let error as SchedulingError {
            if case .forbidden = error { isGated = true }
            phase = .error(error.userMessage ?? "Couldn't load your workflows.")
        } catch {
            phase = .error("Couldn't load your workflows.")
        }
    }

    func refresh() async {
        await load()
    }

    // MARK: Row state

    func isActive(_ workflow: WorkflowDTO) -> Bool {
        activeOverrides[workflow.id] ?? (workflow.isActive ?? true)
    }

    func statusKey(_ workflow: WorkflowDTO) -> String {
        isActive(workflow) ? "active" : "paused"
    }

    // MARK: Toggle active

    func toggleActive(_ workflow: WorkflowDTO) async {
        guard !isGated else { return }
        let next = !isActive(workflow)
        activeOverrides[workflow.id] = next
        do {
            let response: WorkflowResponse = try await client.request(
                SchedulingEndpoints.updateWorkflow(owner: owner, id: workflow.id, UpdateWorkflowRequest(isActive: next))
            )
            replace(response.workflow)
            activeOverrides[workflow.id] = nil
        } catch let error as SchedulingError {
            activeOverrides[workflow.id] = nil
            if case .forbidden = error {
                isGated = true
            } else {
                actionError = error.userMessage ?? "Couldn't update this workflow."
            }
        } catch {
            activeOverrides[workflow.id] = nil
            actionError = "Couldn't update this workflow."
        }
    }

    private func replace(_ workflow: WorkflowDTO) {
        if let idx = workflows.firstIndex(where: { $0.id == workflow.id }) {
            workflows[idx] = workflow
        }
    }

    // MARK: Navigation

    func openDefaultReminders() {
        showRemindersSheet = true
    }

    func remindersSheetDismissed() {
        Task { await load() }
    }

    func createWorkflow() {
        push(.workflowEditor(owner: owner, workflowId: nil))
    }

    func openWorkflow(_ workflow: WorkflowDTO) {
        push(.workflowEditor(owner: owner, workflowId: workflow.id))
    }

    func openTemplates() {
        push(.messageTemplateLibrary(owner: owner))
    }

    func selectScope(_ index: Int) {
        scope = Scope(rawValue: index) ?? .global
    }
}
