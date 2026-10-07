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
    private let onTransfer: (() -> Void)?
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
        onTransfer = nil
    }

    /// `onTransfer` opens Owners when a primary owner tries to leave before transferring ownership.
    init(
        model: HomeMemberRemovalViewModel,
        onTransfer: (() -> Void)? = nil,
        onClose: @escaping (PendingHomeMemberRemoval?) -> Void
    ) {
        _model = State(initialValue: model)
        self.onClose = onClose
        self.onTransfer = onTransfer
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
                    Text("Nothing to finish here.").accessibilityIdentifier("homeMemberRemovalEmpty")
                }
                if model.isWorking {
                    ProgressView("Checking removal…").accessibilityIdentifier("homeMemberRemovalLoading")
                }
                if !model.isCurrent {
                    Text("Close this screen and sign in to the account that started this. Nothing was lost.")
                        .accessibilityIdentifier("homeMemberRemovalSessionGuidance")
                } else if model.transferRequired, let onTransfer {
                    control("Transfer ownership", "homeMemberRemovalTransfer") { onTransfer() }
                } else if !model.opened || model.errorMessage != nil {
                    control("Reload", "homeMemberRemovalReopen") { await model.open() }
                }
                Button("Close") { onClose(nil) }.frame(minHeight: 44).accessibilityIdentifier("homeMemberRemovalClose")
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
            confirmation?.requestId != nil ? "Discard this attempt?"
                : confirmation?.isSelf == true ? "Leave this Home?" : "Remove this member?",
            isPresented: Binding(get: { confirmation != nil }, set: { if !$0 { confirmation = nil } }),
            presenting: confirmation
        ) { selected in
            if let requestId = selected.requestId {
                Button("Discard", role: .destructive) {
                    Task { await model.recover(.cancel, requestId: requestId, lifetime: selected.lifetime) }
                }.accessibilityIdentifier("homeMemberRemovalConfirmCancel")
            } else {
                Button(selected.isSelf ? "Leave" : "Remove", role: .destructive) {
                    Task { await model.submit(reviewedToken: selected.token, lifetime: selected.lifetime) }
                }.accessibilityIdentifier("homeMemberRemovalConfirm")
            }
            Button("Cancel", role: .cancel) {}
        } message: { selected in
            if selected.requestId != nil {
                Text("If it already went through, it stays. Discarding doesn't remove anyone.")
            } else if selected.isSelf {
                Text("Leave \(HomeMemberRemovalValidation.homeLabel(selected.summary))? You'll lose access to this Home. "
                    + "To come back later, add this Home again or ask someone in the household to invite you.")
            } else {
                Text("Remove \(HomeMemberRemovalValidation.targetLabel(selected.summary)) "
                    + "from \(HomeMemberRemovalValidation.homeLabel(selected.summary))? "
                    + "They'll lose access to this Home. You can invite them again later.")
            }
        }
    }

    /// Leaving is the reviewed member removing themselves; the reviewed summary says which.
    private var isSelf: Bool {
        (model.pending?.review ?? model.context?.summary)?.dictValue?["target"]?.dictValue?["is_self"] == .bool(true)
    }

    private var title: String {
        switch model.pending?.outcome?.state {
        case "completed": isSelf ? "You left this Home" : "Member removed"
        case "rejected": "Couldn't finish this"
        case "cancelled": "Attempt discarded"
        default:
            if model.pending != nil { "Check your last removal" } else if model.context != nil {
                isSelf ? "Leave this Home" : "Remove member"
            } else if model.transferRequired { "Leave this Home" } else { "Household membership" }
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
            Text("Role: \(roleLabel(target["role_base"]?.stringValue))")
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
            Text(isSelf ? "You'll lose access to this Home." : "They'll lose access to this Home.")
            Button(
                isSelf ? "Leave Home" : "Remove member",
                role: .destructive
            ) {
                confirmation = Confirmation(token: context.token, requestId: nil, lifetime: model.generation, summary: context.summary)
            }.frame(minHeight: 44).disabled(!model.canSubmit).accessibilityIdentifier("homeMemberRemovalSubmit")
        }
    }

    private func recovery(_ original: PendingHomeMemberRemoval) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            if model.recoveringAnotherTarget {
                Text("You have an unfinished removal for the member below. Finish it before removing someone else.")
                    .accessibilityIdentifier("homeMemberRemovalDifferentTarget")
            }
            identity(original.review)
            if let outcome = original.outcome, outcome.isTerminal {
                if outcome.state == "completed" {
                    Text(isSelf ? "You left this Home." : "They no longer have access to this Home.")
                    if let raw = outcome.fields["completed_at"]?.stringValue, let date = HomeInvitationValidation.date(raw) {
                        Text("Recorded \(date.formatted(date: .abbreviated, time: .shortened))")
                    }
                } else if outcome.state == "rejected" {
                    Text(HomeMemberRemovalError.message(outcome.code))
                } else {
                    Text("Nothing changed. This attempt was discarded before it took effect.")
                }
                control("Done", "homeMemberRemovalAcknowledge") {
                    if let result = await model.acknowledge(requestId: original.requestId) { onClose(result) }
                }
            } else {
                Text("We couldn't confirm whether this went through. Check again, or try again.")
                control("Check again", "homeMemberRemovalCheck") {
                    await model.recover(.check, requestId: original.requestId, lifetime: model.generation)
                }
                control("Try again", "homeMemberRemovalRetry") {
                    await model.recover(.retry, requestId: original.requestId, lifetime: model.generation)
                }
                Button("Discard attempt", role: .destructive) {
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
