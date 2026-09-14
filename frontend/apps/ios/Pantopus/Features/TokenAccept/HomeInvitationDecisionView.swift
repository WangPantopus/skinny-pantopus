import SwiftUI

@MainActor
struct HomeInvitationDecisionView: View {
    @State var model: HomeInvitationDecisionViewModel
    let onClose: () -> Void
    let onReopen: () async -> Void
    @State private var confirmation: Confirmation?
    @State private var accountSwitchLifetime: Int?
    private struct Confirmation: Identifiable {
        let id = UUID()
        let action: HomeInvitationAction?
        let reviewedToken: String
        let requestId: String
        let lifetime: Int
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Text(title).pantopusTextStyle(.h2).accessibilityIdentifier("homeInvitationHeading")
                Text("Signed in as \(model.accountLabel)")
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityIdentifier("homeInvitationAccount")
                if let error = model.error {
                    Text(error).foregroundStyle(Theme.Color.error).accessibilityIdentifier("homeInvitationError")
                }
                if let draft = model.pending { recovery(draft) } else if let context = model.context { offer(context) }
                if model.isWorking { ProgressView("Checking your invitation…").accessibilityIdentifier("homeInvitationLoading") }
                if model.error != nil || model.context == nil && model.pending == nil {
                    control("Reopen invitation", "homeInvitationReopen") { await onReopen() }
                }
                Button("Use another account") { accountSwitchLifetime = model.generation }
                    .frame(minHeight: 44).disabled(model.isWorking).accessibilityIdentifier("homeInvitationSwitchAccount")
                Button("Close", action: onClose).frame(minHeight: 44).accessibilityIdentifier("homeInvitationClose")
                Text("A saved decision proves what happened. Current household access and message delivery are checked separately.")
                    .pantopusTextStyle(.caption).foregroundStyle(Theme.Color.appTextSecondary)
            }
            .padding(Spacing.s5).frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("homeInvitationDecision")
        .task { await model.open() }
        .task(id: model.context?.decisionToken) {
            guard let expiry = model.context?.expiresAt else { return }
            let delay = max(0, expiry.timeIntervalSinceNow)
            do { try await Task.sleep(for: .seconds(delay)) } catch { return }
            confirmation = nil
            await model.open()
        }
        .onDisappear { confirmation = nil
            accountSwitchLifetime = nil
            model.suspend()
        }
        .confirmationDialog(
            "Use another account?",
            isPresented: Binding(get: { accountSwitchLifetime != nil }, set: { if !$0 { accountSwitchLifetime = nil } }),
            titleVisibility: .visible,
            presenting: accountSwitchLifetime
        ) { lifetime in
            Button("Sign out and continue") { Task { await model.switchAccount(lifetime: lifetime) } }
                .accessibilityIdentifier("homeInvitationConfirmSwitchAccount")
        } message: { _ in
            Text("You will be signed out. Any saved invitation decision stays protected for this account.")
        }
        .confirmationDialog(
            confirmation?.action == .accept ? "Accept this invitation?" : confirmation?
                .action == .decline ? "Decline this invitation?" : "Cancel the original attempt?",
            isPresented: Binding(get: { confirmation != nil }, set: { if !$0 { confirmation = nil } }),
            titleVisibility: .visible,
            presenting: confirmation
        ) { selected in
            if let action = selected.action {
                Button(action == .accept ? "Confirm acceptance" : "Confirm decline", role: action == .decline ? .destructive : nil) {
                    Task { await model.decide(action, reviewedToken: selected.reviewedToken, lifetime: selected.lifetime) }
                }.accessibilityIdentifier("homeInvitationConfirmDecision")
            } else {
                Button("Confirm cancellation", role: .destructive) {
                    Task { await model.recover(.cancel, requestId: selected.requestId, lifetime: selected.lifetime) }
                }.accessibilityIdentifier("homeInvitationConfirmCancel")
            }
        } message: { selected in
            Text(confirmationMessage(selected))
        }
    }

    private func confirmationMessage(_ selected: Confirmation) -> String {
        if selected.action == nil {
            return "If the decision is already saved, its original result is recovered. "
                + "Cancelling an attempt does not decline the invitation."
        }
        return "\(model.accountLabel) will decide on the invitation to \(model.context?.homeLabel ?? "this Home"). "
            + "Household permissions and access dates still apply."
    }

    private var title: String {
        guard let draft = model.pending else { return model.context == nil ? "Invitation status" : "You're invited" }
        switch draft.outcome?.state {
        case "completed": return draft.action == .accept ? "Acceptance saved" : "Decline saved"
        case "cancelled": return "Decision attempt cancelled"
        case "rejected": return "Decision needs review"
        default: return "Recover your invitation decision"
        }
    }

    private func offer(_ context: HomeInvitationDecisionContext) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text(context.homeLabel).pantopusTextStyle(.h3).accessibilityIdentifier("homeInvitationHome")
            Text(context.city).foregroundStyle(Theme.Color.appTextSecondary)
            Text("Invited by \(context.inviter)")
            Text("Offered role: \(TokenAcceptViewModel.humanRole(context.role))")
            Text("Household permissions determine what you can open or manage. This invitation does not grant ownership.")
            ForEach(
                [("access_start_at", "Access starts"), ("access_end_at", "Access ends"), ("expires_at", "Invitation expires")],
                id: \.0
            ) { key, label in
                if let raw = context.invitation[key]?.stringValue, let date = HomeInvitationValidation.date(raw) {
                    Text("\(label) \(date.formatted(date: .abbreviated, time: .shortened)).").pantopusTextStyle(.caption)
                }
            }
            Button("Accept invitation") {
                confirm(.accept, context)
            }
            .frame(minHeight: 44)
            .disabled(!model.canDecide)
            .accessibilityIdentifier("homeInvitationAccept")
            Button("Decline invitation") {
                confirm(.decline, context)
            }
            .frame(minHeight: 44)
            .disabled(!model.canDecide)
            .accessibilityIdentifier("homeInvitationDecline")
        }
    }

    private func confirm(_ action: HomeInvitationAction, _ context: HomeInvitationDecisionContext) {
        confirmation = Confirmation(action: action, reviewedToken: context.decisionToken, requestId: "", lifetime: model.generation)
    }

    private func recovery(_ draft: PendingHomeInvitationDecision) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text(draft.homeLabel).pantopusTextStyle(.h3).accessibilityIdentifier("homeInvitationOriginalHome")
            Text("Original decision: \(draft.action == .accept ? "Accept invitation" : "Decline invitation")")
            if draft.token != model.token {
                Text("This is an earlier invitation. Finish its recovery before deciding on the link you just opened.")
            }
            Text(explanation(draft)).accessibilityIdentifier("homeInvitationExplanation")
            if draft.outcome?.state == "completed", draft.action == .accept {
                control("Check current Home access", "homeInvitationAccess") { await model.checkAccess() }
                if let progress = model.progress {
                    Text(progress.currentAccess == "shared" ? "Your current account can open this Home. Household permissions still apply."
                        : "Your saved acceptance does not provide current shared access. My Homes shows the available next steps.")
                        .accessibilityIdentifier("homeInvitationCurrentAccess")
                    if progress.currentAccess == "shared" {
                        control("Open Home", "homeInvitationOpenHome") {
                            if let original = await model.acknowledge(requestId: draft.requestId, openHome: true) {
                                onClose()
                                DeepLinkRouter.shared.handle(path: "/homes/\(original.homeId)/dashboard")
                            }
                        }
                    }
                }
            }
            if model.canAcknowledge {
                control(draft.outcome?.state == "completed" ? "Done" : "Review invitation again", "homeInvitationAcknowledge") {
                    guard let original = await model.acknowledge(requestId: draft.requestId) else { return }
                    if original.outcome?.state == "completed", original.token == model.token { onClose() } else { await onReopen() }
                }
            } else {
                control("Check saved decision", "homeInvitationCheck") { await model.recover(
                    .check,
                    requestId: draft.requestId,
                    lifetime: model.generation
                )
                }
                control("Retry original decision", "homeInvitationRetry") { await model.recover(
                    .retry,
                    requestId: draft.requestId,
                    lifetime: model.generation
                )
                }
                Button("Cancel original attempt") {
                    confirmation = Confirmation(action: nil, reviewedToken: "", requestId: draft.requestId, lifetime: model.generation)
                }.frame(minHeight: 44).disabled(model.isWorking).accessibilityIdentifier("homeInvitationCancel")
            }
        }
    }

    private func explanation(_ draft: PendingHomeInvitationDecision) -> String {
        switch draft.outcome?.state {
        case "completed": draft.action == .accept
            ? "Your acceptance is saved. Current household access is checked separately; roles, permissions and access dates still apply."
            : "Your decline is saved for this account. An open invitation link may remain available to other people."
        case "cancelled": "The server confirmed that this attempt cannot accept or decline the invitation."
        case "rejected": HomeInvitationDecisionError.message(draft.outcome?.code)
        default: "Your original decision is stored securely on this device. Check its result or retry that same decision. "
            + "Confirm cancellation before starting a different attempt."
        }
    }

    private func control(_ title: String, _ identifier: String, action: @escaping () async -> Void) -> some View {
        Button(title) { Task { await action() } }.frame(minHeight: 44).disabled(model.isWorking).accessibilityIdentifier(identifier)
    }
}
