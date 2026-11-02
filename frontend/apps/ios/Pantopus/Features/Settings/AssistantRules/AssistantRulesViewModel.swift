//
//  AssistantRulesViewModel.swift
//  Pantopus
//
//  Settings → What Pantopus does for you
//  (`docs/product/ai-assistant-phase3-contract-2026-10-22.md` §18.5): the
//  standing rules the person turned on from a card, each with its switch,
//  "Until Jan 16 · Extend" for a weekly plan, why it paused, its last runs
//  and Delete. Read from the server each time.
//

import Foundation
import Observation

@Observable
@MainActor
final class AssistantRulesViewModel {
    enum State: Equatable {
        case loading
        case empty
        case loaded
        case error(String)
    }

    private(set) var state: State = .loading
    private(set) var rules: [AIRuleDTO] = []
    /// Rules with a switch, Extend or Delete in flight.
    private(set) var busyIds: Set<String> = []
    /// A switch's new position while its change is in flight.
    private(set) var pendingEnabled: [String: Bool] = [:]
    var toast: ToastMessage?
    /// The rule whose Delete waits for its confirmation.
    var deleting: AIRuleDTO?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    func load() async {
        if case .loaded = state {} else { state = .loading }
        await read()
    }

    func refresh() async {
        await read()
    }

    private func read() async {
        do {
            let response: AIRulesResponse = try await api.request(AIEndpoints.rules())
            rules = response.rules
            state = rules.isEmpty ? .empty : .loaded
        } catch {
            if case .loaded = state {
                toast = ToastMessage(text: "Couldn\u{2019}t refresh. Check your connection and try again.", kind: .error)
            } else {
                state = .error((error as? APIError)?.errorDescription ?? "Check your connection and try again.")
            }
        }
    }

    // MARK: - Actions

    /// The switch. Turning one back on is checked again by the server ("It can't run: …").
    func setEnabled(_ rule: AIRuleDTO, _ enabled: Bool) async {
        guard !busyIds.contains(rule.id) else { return }
        pendingEnabled[rule.id] = enabled
        defer { pendingEnabled[rule.id] = nil }
        await change(rule, AIRuleChangeRequest(enabled: enabled, extend: nil), done: enabled ? "On" : "Off")
    }

    /// The switch as shown: its new position while the change is in flight.
    func isOn(_ rule: AIRuleDTO) -> Bool {
        pendingEnabled[rule.id] ?? rule.enabled
    }

    /// Twelve more weeks for a weekly plan (and back on, if it ended).
    func extend(_ rule: AIRuleDTO) async {
        await change(rule, AIRuleChangeRequest(enabled: nil, extend: true), done: "Extended for 12 weeks")
    }

    private func change(_ rule: AIRuleDTO, _ body: AIRuleChangeRequest, done: String) async {
        guard !busyIds.contains(rule.id) else { return }
        busyIds.insert(rule.id)
        defer { busyIds.remove(rule.id) }
        do {
            let response: AIRuleResponse = try await api.request(AIEndpoints.changeRule(id: rule.id, body))
            replace(response.rule)
            toast = ToastMessage(text: done, kind: .success)
        } catch APIError.notFound {
            remove(rule.id)
            toast = ToastMessage(text: "That rule is gone. It may have been deleted on another device.", kind: .error)
        } catch {
            // The switch goes back to what the server has.
            toast = ToastMessage(text: Self.message(error, fallback: "Couldn\u{2019}t change it. Try again."), kind: .error)
        }
    }

    /// Delete, once the person confirmed it. One already gone counts as deleted.
    func delete(_ rule: AIRuleDTO) async {
        guard !busyIds.contains(rule.id) else { return }
        busyIds.insert(rule.id)
        defer { busyIds.remove(rule.id) }
        do {
            try await api.request(AIEndpoints.deleteRule(id: rule.id))
        } catch APIError.notFound {
            // Deleted already.
        } catch {
            toast = ToastMessage(text: Self.message(error, fallback: "Couldn\u{2019}t delete it. Try again."), kind: .error)
            return
        }
        remove(rule.id)
        toast = ToastMessage(text: "Deleted", kind: .success)
    }

    private func replace(_ rule: AIRuleDTO) {
        guard let index = rules.firstIndex(where: { $0.id == rule.id }) else { return }
        rules[index] = rule
    }

    private func remove(_ id: String) {
        rules.removeAll { $0.id == id }
        if rules.isEmpty { state = .empty }
    }

    // MARK: - Projection

    /// "Until Jan 16", or "Ended Jan 16" once its weeks are up; nil for a pickup reminder.
    static func until(_ rule: AIRuleDTO, now: Date = Date()) -> String? {
        guard rule.kind == "plan_repeat", let end = AssistantMemoryViewModel.parse(rule.endsAt) else { return nil }
        let day = AssistantMemoryViewModel.day(end, now: now)
        return end <= now || rule.pausedReason == "ended" ? "Ended \(day)" : "Until \(day)"
    }

    /// Why it stopped on its own.
    static func pausedLine(_ reason: String?) -> String? {
        switch reason {
        case "nobody_came": "Paused: nobody joined two weeks in a row."
        case "cannot_post": "Paused: Pantopus couldn\u{2019}t post it."
        case "ended": "Ended: its 12 weeks are up. Extend it to keep going."
        case "member_left": "Paused: that person left the household, or you can no longer assign tasks there."
        default: nil
        }
    }

    /// "Wed, Oct 28" for a run.
    static func runDay(_ raw: String?) -> String? {
        guard let date = AssistantMemoryViewModel.parse(raw) else { return nil }
        return date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }

    static func message(_ error: any Error, fallback: String) -> String {
        AssistantMemoryViewModel.message(error, fallback: fallback)
    }
}
