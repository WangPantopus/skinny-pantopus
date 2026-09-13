import SwiftUI

struct HomeMemberRemovalPresentation: Identifiable {
    let id = UUID()
    let target: HomeMemberRemovalTarget?
}

@MainActor
struct HomeMemberRemovalView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var model: HomeMemberRemovalViewModel
    @State private var visible = false
    @State private var confirmation: Confirmation?
    private let onClose: (PendingHomeMemberRemoval?) -> Void
    private struct Confirmation: Identifiable {
        let id = UUID()
        let token: String
        let requestId: String?
        let lifetime: Int
        let summary: JSONValue
        var isSelf: Bool {
            summary.dictValue?["target"]?.dictValue?["is_self"] == .bool(true)
        }
    }

    init(target: HomeMemberRemovalTarget? = nil, onClose: @escaping (PendingHomeMemberRemoval?) -> Void) {
        _model = State(initialValue: HomeMemberRemovalViewModel(target: target))
        self.onClose = onClose
    }

    init(model: HomeMemberRemovalViewModel, onClose: @escaping (PendingHomeMemberRemoval?) -> Void) {
        _model = State(initialValue: model)
        self.onClose = onClose
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Text(title).pantopusTextStyle(.h2).accessibilityIdentifier("homeMemberRemovalHeading")
                Text(model.isCurrent ? "Signed in as \(model.accountLabel)" : "Review opened for \(model.accountLabel)")
                    .pantopusTextStyle(.body)
                    .accessibilityIdentifier("homeMemberRemovalAccount")
                if !model.isCurrent {
                    Text(HomeMemberRemovalError.sessionChanged.localizedDescription)
                        .foregroundStyle(Theme.Color.error).accessibilityIdentifier("homeMemberRemovalError")
                } else if let message = model.errorMessage {
                    Text(message).foregroundStyle(Theme.Color.error).accessibilityIdentifier("homeMemberRemovalError")
                }
                if let original = model.pending {
                    recovery(original)
                } else if let context = model.context {
                    review(context)
                } else if model.isCurrent && model.opened && model.errorMessage == nil {
                    Text("No saved removal action for this account.").accessibilityIdentifier("homeMemberRemovalEmpty")
                }
                if model.isWorking {
                    ProgressView("Checking removal…").accessibilityIdentifier("homeMemberRemovalLoading")
                }
                if !model.isCurrent {
                    Text("Close this screen, then open removal recovery again under the original account. Your saved action is kept.")
                        .accessibilityIdentifier("homeMemberRemovalSessionGuidance")
                } else if !model.opened || model.errorMessage != nil {
                    control("Reopen removal recovery", "homeMemberRemovalReopen") { await model.open() }
                }
                Button("Close") { onClose(nil) }.frame(minHeight: 44).accessibilityIdentifier("homeMemberRemovalClose")
                Text("Saved removal results describe an original action. The current member list and Home access are checked separately.")
                    .pantopusTextStyle(.caption).foregroundStyle(Theme.Color.appTextSecondary)
            }.padding(Spacing.s5).frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.Color.appBg)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("homeMemberRemoval")
        .task { visible = true
            await model.open()
        }
        .onDisappear { visible = false
            confirmation = nil
            model.suspend()
        }
        .onChange(of: scenePhase) { _, phase in
            guard visible else { return }
            confirmation = nil
            if phase == .active { Task { await model.open() } } else { model.suspend() }
        }
        .onChange(of: model.isCurrent) { _, current in
            if !current { confirmation = nil
                model.suspend()
            }
        }
        .alert(
            confirmation?.requestId != nil ? "Cancel the original attempt?"
                : confirmation?.isSelf == true ? "Confirm leaving this Home?" : "Confirm the reviewed removal?",
            isPresented: Binding(get: { confirmation != nil }, set: { if !$0 { confirmation = nil } }),
            presenting: confirmation
        ) { selected in
            if let requestId = selected.requestId {
                Button("Confirm cancellation", role: .destructive) {
                    Task { await model.recover(.cancel, requestId: requestId, lifetime: selected.lifetime) }
                }.accessibilityIdentifier("homeMemberRemovalConfirmCancel")
            } else {
                Button(selected.isSelf ? "Confirm leave" : "Confirm removal", role: .destructive) {
                    Task { await model.submit(reviewedToken: selected.token, lifetime: selected.lifetime) }
                }.accessibilityIdentifier("homeMemberRemovalConfirm")
            }
            Button("Cancel", role: .cancel) {}
        } message: { selected in
            if selected.requestId != nil {
                Text("This cancels the saved attempt only if removal has not already completed. A completed removal cannot be undone here.")
            } else if selected.isSelf {
                Text("Leave \(HomeMemberRemovalValidation.homeLabel(selected.summary)) and end your reviewed household membership? "
                    + "Current membership and ownership are checked again before leaving.")
            } else {
                Text("Remove \(HomeMemberRemovalValidation.targetLabel(selected.summary)) "
                    + "from \(HomeMemberRemovalValidation.homeLabel(selected.summary))? "
                    + "Current permission and membership are checked again before removal.")
            }
        }
    }

    private var title: String {
        switch model.pending?.outcome?.state {
        case "completed": "Removal recorded"
        case "rejected": "Removal did not proceed"
        case "cancelled": "Attempt cancelled"
        default: model.pending == nil ? "Review member removal" : "Recover original removal"
        }
    }

    private func identity(_ value: JSONValue) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(HomeMemberRemovalValidation.targetLabel(value))
                .pantopusTextStyle(.h3)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("homeMemberRemovalTarget")
            Text(HomeMemberRemovalValidation.homeLabel(value)).fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("homeMemberRemovalHome")
            let target = value.dictValue?["target"]?.dictValue ?? [:]
            if target["is_self"] == .bool(true) { Text("Your household membership") }
            Text("Reviewed role: \(roleLabel(target["role_base"]?.stringValue))")
            ForEach(["start_at", "end_at", "access_start_at", "access_end_at"], id: \.self) { key in
                if let raw = target[key]?.stringValue, let date = HomeInvitationValidation.date(raw) {
                    Text("\(dateLabel(key)): \(date.formatted(date: .abbreviated, time: .shortened))")
                }
            }
        }
    }

    private func review(_ context: HomeMemberRemovalContext) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            identity(context.summary)
            Text("This ends the reviewed household membership and retires access tied to it. Recorded claims and decisions are kept. "
                + "Ownership changes require their own flow.")
            Button(
                context.fields["target"]?.dictValue?["is_self"] == .bool(true) ? "Leave reviewed Home" : "Remove reviewed member",
                role: .destructive
            ) {
                confirmation = Confirmation(token: context.token, requestId: nil, lifetime: model.generation, summary: context.summary)
            }.frame(minHeight: 44).disabled(!model.canSubmit).accessibilityIdentifier("homeMemberRemovalSubmit")
        }
    }

    private func recovery(_ original: PendingHomeMemberRemoval) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            if model.recoveringAnotherTarget {
                Text("Recovering the saved original for the member and Home below. The newly selected member has not been removed.")
                    .accessibilityIdentifier("homeMemberRemovalDifferentTarget")
            }
            identity(original.review)
            if let outcome = original.outcome, outcome.isTerminal {
                if outcome.state == "completed" {
                    Text("This original removal completed. It does not establish the member's current access.")
                    if let raw = outcome.fields["completed_at"]?.stringValue, let date = HomeInvitationValidation.date(raw) {
                        Text("Recorded \(date.formatted(date: .abbreviated, time: .shortened))")
                    }
                } else if outcome.state == "rejected" {
                    Text(HomeMemberRemovalError.message(outcome.code))
                } else {
                    Text("This original attempt was cancelled. No removal was performed by this attempt.")
                }
                control("Acknowledge original result", "homeMemberRemovalAcknowledge") {
                    if let result = await model.acknowledge(requestId: original.requestId) { onClose(result) }
                }
            } else {
                Text("Keep this original until its result is confirmed. A retry uses the same reviewed action.")
                control("Check original status", "homeMemberRemovalCheck") {
                    await model.recover(.check, requestId: original.requestId, lifetime: model.generation)
                }
                control("Retry original removal", "homeMemberRemovalRetry") {
                    await model.recover(.retry, requestId: original.requestId, lifetime: model.generation)
                }
                Button("Cancel original attempt", role: .destructive) {
                    confirmation = Confirmation(
                        token: original.token,
                        requestId: original.requestId,
                        lifetime: model.generation,
                        summary: original.review
                    )
                }.frame(minHeight: 44).disabled(model.isWorking).accessibilityIdentifier("homeMemberRemovalCancel")
            }
        }
    }

    private func control(_ title: String, _ identifier: String, action: @escaping @MainActor () async -> Void) -> some View {
        Button(title) { Task { await action() } }
            .frame(minHeight: 44)
            .disabled(model.isWorking || !model.isCurrent)
            .accessibilityIdentifier(identifier)
    }

    private func roleLabel(_ value: String?) -> String {
        guard let value else { return "Not recorded" }
        return value.replacingOccurrences(of: "_", with: " ").capitalized
    }

    private func dateLabel(_ value: String) -> String {
        switch value {
        case "start_at": "Membership starts"
        case "end_at": "Membership ends"
        case "access_start_at": "Access starts"
        default: "Access ends"
        }
    }
}
