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
                    control("Reload", "homeInvitationReopen") { await onReopen() }
                }
                Button("Use another account") { accountSwitchLifetime = model.generation }
                    .frame(minHeight: 44).disabled(model.isWorking).accessibilityIdentifier("homeInvitationSwitchAccount")
                Button("Close", action: onClose).frame(minHeight: 44).accessibilityIdentifier("homeInvitationClose")
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
            Text("You'll be signed out. Any answer you already gave stays with this account.")
        }
        // An alert, not a confirmation dialog: the dialog's popover is dismissed by a tap outside it, and a double-tapped
        // opener's second tap landed there while it was still opening, leaving a shown dialog whose confirm did nothing.
        // An alert ignores outside taps (Android shows this confirmation as a modal dialog too).
        .alert(
            confirmation?.action == .accept ? "Accept this invitation?" : confirmation?
                .action == .decline ? "Decline this invitation?" : "Discard this attempt?",
            isPresented: Binding(get: { confirmation != nil }, set: { if !$0 { confirmation = nil } }),
            presenting: confirmation
        ) { selected in
            if let action = selected.action {
                Button(action == .accept ? "Accept" : "Decline", role: action == .decline ? .destructive : nil) {
                    Task { await model.decide(action, reviewedToken: selected.reviewedToken, lifetime: selected.lifetime) }
                }.accessibilityIdentifier("homeInvitationConfirmDecision")
            } else {
                Button("Discard", role: .destructive) {
                    Task { await model.recover(.cancel, requestId: selected.requestId, lifetime: selected.lifetime) }
                }.accessibilityIdentifier("homeInvitationConfirmCancel")
            }
            Button("Keep reviewing", role: .cancel) {}
        } message: { selected in
            Text(confirmationMessage(selected))
        }
    }

    private func confirmationMessage(_ selected: Confirmation) -> String {
        let home = model.context?.homeLabel ?? "this Home"
        switch selected.action {
        case nil: return "If your answer already went through, it stays. Discarding doesn't decline the invitation."
        case .decline: return "\(model.accountLabel) won't join the household at \(home). The sender can invite you again later."
        default: return "\(model.accountLabel) will join the household at \(home). "
            + "What you can open depends on your role and the invitation's dates."
        }
    }

    private var title: String {
        guard let draft = model.pending else { return model.context == nil ? "Invitation status" : "You're invited" }
        switch draft.outcome?.state {
        case "completed": return draft.action == .accept ? "Invitation accepted" : "Invitation declined"
        case "cancelled": return "Attempt discarded"
        case "rejected": return "Couldn't finish this"
        default: return "Check your answer"
        }
    }

    private func offer(_ context: HomeInvitationDecisionContext) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text(context.homeLabel).pantopusTextStyle(.h3).accessibilityIdentifier("homeInvitationHome")
            Text(context.city).foregroundStyle(Theme.Color.appTextSecondary)
            Text("Invited by \(context.inviter)")
            Text("Offered role: \(TokenAcceptViewModel.humanRole(context.role))")
            Text(
                """
                Household permissions determine what you can open or manage. \
                This invitation gives you household access. To send neighbor messages \
                or get a residency letter, verify the address yourself.
                """
            )
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
        // A double tap's second tap must not replace the confirmation it just opened: the replaced one's button does nothing.
        guard confirmation == nil else { return }
        confirmation = Confirmation(action: action, reviewedToken: context.decisionToken, requestId: "", lifetime: model.generation)
    }

    private func recovery(_ draft: PendingHomeInvitationDecision) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text(draft.homeLabel).pantopusTextStyle(.h3).accessibilityIdentifier("homeInvitationOriginalHome")
            Text("Your answer: \(draft.action == .accept ? "Accept" : "Decline")")
            if draft.token != model.token {
                Text("This is an earlier invitation. Finish it before answering the one you just opened.")
            }
            Text(explanation(draft)).accessibilityIdentifier("homeInvitationExplanation")
            if draft.outcome?.state == "completed", draft.action == .accept {
                control("Check Home access", "homeInvitationAccess") { await model.checkAccess() }
                if let progress = model.progress {
                    Text(progress.currentAccess == "shared" ? "You can open this Home now."
                        : "You can't open this Home yet. My Homes shows what's next.")
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
                control("Check again", "homeInvitationCheck") { await model.recover(
                    .check,
                    requestId: draft.requestId,
                    lifetime: model.generation
                )
                }
                control("Try again", "homeInvitationRetry") { await model.recover(
                    .retry,
                    requestId: draft.requestId,
                    lifetime: model.generation
                )
                }
                Button("Discard attempt") {
                    guard confirmation == nil else { return }
                    confirmation = Confirmation(action: nil, reviewedToken: "", requestId: draft.requestId, lifetime: model.generation)
                }.frame(minHeight: 44).disabled(model.isWorking).accessibilityIdentifier("homeInvitationCancel")
            }
        }
    }

    private func explanation(_ draft: PendingHomeInvitationDecision) -> String {
        switch draft.outcome?.state {
        case "completed": draft.action == .accept
            ? "You're part of this household now. What you can open depends on your role and the invitation's dates."
            : "You won't join this household. If it was shared as an open link, other people with the link can still use it."
        case "cancelled": "Nothing changed. This attempt was discarded before it took effect."
        case "rejected": HomeInvitationDecisionError.message(draft.outcome?.code)
        default: "We couldn't confirm your answer. It's saved on this device, "
            + "so you can check again or try again without answering twice."
        }
    }

    private func control(_ title: String, _ identifier: String, action: @escaping () async -> Void) -> some View {
        Button(title) { Task { await action() } }.frame(minHeight: 44).disabled(model.isWorking).accessibilityIdentifier(identifier)
    }
}
