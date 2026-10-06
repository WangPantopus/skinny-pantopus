import SwiftUI
import UIKit

/// Review, save and recover ordinary Home invitation sender commands.
@MainActor
struct InviteMemberWizardView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var model: InviteMemberWizardViewModel
    @State private var visible = false
    @State private var confirmation: Confirmation?
    @State private var sharing: Sharing?
    private struct Sharing: Identifiable {
        let id = UUID()
        let url: URL
    }

    private let onClose: (PendingHomeInvitationSender?) -> Void
    private struct Confirmation: Identifiable {
        let id = UUID()
        let token: String
        let requestId: String?
        let lifetime: Int
    }

    init(
        homeId: String,
        target: HomeInvitationSenderTarget = .init(action: .create, invitationId: nil),
        onClose: @escaping (PendingHomeInvitationSender?) -> Void
    ) {
        _model = State(initialValue: InviteMemberWizardViewModel(homeId: homeId, target: target))
        self.onClose = onClose
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Text(title).pantopusTextStyle(.h2).accessibilityIdentifier("homeInvitationSenderHeading")
                Text("Signed in as \(model.accountLabel)")
                    .pantopusTextStyle(.body)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityIdentifier("homeInvitationSenderAccount")
                if let error = model.errorMessage {
                    Text(error).foregroundStyle(Theme.Color.error).accessibilityIdentifier("homeInvitationSenderError")
                }
                if let original = model.pending {
                    recovery(original)
                } else if let context = model.context {
                    review(context)
                } else if model.canPrepare && model.target.action == .create {
                    form
                }
                if model.isWorking { ProgressView("Checking invitation…").accessibilityIdentifier("homeInvitationSenderLoading") }
                if model.errorMessage != nil || !model.opened {
                    control("Reload", "homeInvitationSenderReopen") { await model.open() }
                }
                Button("Close") { onClose(nil) }.frame(minHeight: 44).accessibilityIdentifier("homeInvitationSenderClose")
                Text("An invitation gives someone household access for the role you choose. "
                    + "It doesn't verify that they live here or own the Home.")
                    .pantopusTextStyle(.caption).foregroundStyle(Theme.Color.appTextSecondary)
            }.padding(Spacing.s5).frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.Color.appBg)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("inviteMemberWizard")
        .task { visible = true
            await model.open()
        }
        .task(id: model.sharingExpiresAt) {
            guard let expiry = model.sharingExpiresAt else { return }
            do { try await Task.sleep(for: .seconds(max(0, expiry.timeIntervalSinceNow))) } catch { return }
            model.retireSharing()
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
        .onChange(of: model.sharingChecked) { _, checked in if !checked { sharing = nil } }
        .sheet(item: $sharing) { item in HomeInvitationSenderActivity(url: item.url) }
        .confirmationDialog(
            confirmation?.requestId == nil ? confirmationTitle : "Discard this attempt?",
            isPresented: Binding(get: { confirmation != nil }, set: { if !$0 { confirmation = nil } }),
            titleVisibility: .visible,
            presenting: confirmation
        ) { selected in
            if let requestId = selected.requestId {
                Button("Discard", role: .destructive) {
                    Task { await model.recover(.cancel, requestId: requestId, lifetime: selected.lifetime) }
                }.accessibilityIdentifier("homeInvitationSenderConfirmCancel")
            } else {
                Button(
                    model.target.action == .withdraw ? "Withdraw" : model.target.action == .resend ? "Resend" : "Send",
                    role: model.target.action == .withdraw ? .destructive : nil
                ) {
                    Task { await model.submit(reviewedToken: selected.token, lifetime: selected.lifetime) }
                }.accessibilityIdentifier("homeInvitationSenderConfirm")
            }
        } message: { selected in
            Text(selected.requestId == nil ? confirmationMessage : cancellationMessage)
        }
    }

    private var title: String {
        if let original = model.pending {
            switch original.outcome?.state {
            case "completed":
                switch original.action {
                case .withdraw: return "Invitation withdrawn"
                case .resend: return "Resend requested"
                default: return "Invitation created"
                }
            case "cancelled": return "Attempt discarded"
            case "rejected": return "Couldn't finish this"
            default: return "Check your last invitation"
            }
        }
        switch model.target.action {
        case .withdraw: return "Withdraw invitation"
        case .resend: return "Resend invitation"
        case .create: return "Invite member"
        }
    }

    private var confirmationTitle: String {
        switch model.target.action {
        case .withdraw: "Withdraw this invitation?"
        case .resend: "Resend this invitation?"
        case .create: "Send this invitation?"
        }
    }

    private var confirmationMessage: String {
        switch model.target.action {
        case .create: "We'll send them the invitation. They join the household only if they accept."
        case .resend: "We'll send the same invitation again. "
            + "Links already sent keep working, and the expiry date doesn't change."
        case .withdraw: "They won't be able to accept it anymore. Anyone already in the household stays."
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            PantopusTextField(
                "Email",
                text: $model.email,
                placeholder: "name@example.com",
                keyboardType: .emailAddress,
                contentType: .emailAddress,
                identifier: "inviteMember_email"
            )
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            Picker("Household role", selection: $model.role) {
                Text("Member").tag("member")
                Text("Guest").tag("guest")
            }.pickerStyle(.segmented).accessibilityIdentifier("homeInvitationSenderRole")
            Text("Members can see and help with household tasks. Guests get limited, view-only access. "
                + "For a short visit, send a guest pass from the Guests tab instead.")
                .pantopusTextStyle(.caption).foregroundStyle(Theme.Color.appTextSecondary)
            Text("Personal note (optional)").pantopusTextStyle(.caption)
            TextEditor(text: $model.message).frame(minHeight: 80)
                .accessibilityIdentifier("inviteMember_message")
            control("Review invitation", "homeInvitationSenderPrepare") { await model.prepare() }
        }
    }

    private func review(_ context: HomeInvitationSenderContext) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Check the details").pantopusTextStyle(.h3)
            if model.target.action == .create, let payload = context.intent.dictValue?["payload"]?.dictValue {
                Text(payload["email"]?.stringValue ?? "").accessibilityIdentifier("homeInvitationSenderRecipient")
                Text("Role: \(TokenAcceptViewModel.humanRole(payload["relationship"]?.stringValue ?? ""))")
                if let preset = presetLine(payload["preset_key"]?.stringValue) { Text(preset) }
                if let note = payload["message"]?.stringValue { Text(note) }
            } else {
                Text(context.invitation["invitee"]?.dictValue.map(HomeInvitationSenderValidation.profileLabel)
                    ?? context.invitation["invitee_email"]?.stringValue ?? "Selected account")
                    .accessibilityIdentifier("homeInvitationSenderRecipient")
                let role = HomeInvitationSenderValidation.effectiveRole(context.invitation).map(TokenAcceptViewModel.humanRole)
                Text("Role: \(role ?? "As set in the invitation")")
                if let preset = presetLine(context.invitation["proposed_preset_key"]?.stringValue) { Text(preset) }
                ForEach(["expires_at", "access_start_at", "access_end_at"], id: \.self) { key in
                    if let raw = context.invitation[key]?.stringValue, let date = HomeInvitationValidation.date(raw) {
                        Text("\(dateLabel(key)): \(date.formatted(date: .abbreviated, time: .shortened))")
                    }
                }
            }
            Text(confirmationMessage).foregroundStyle(Theme.Color.appTextSecondary)
            Button(submitLabel) {
                confirmation = Confirmation(token: context.token, requestId: nil, lifetime: model.generation)
            }.frame(minHeight: 44).disabled(!model.canSubmit).accessibilityIdentifier("homeInvitationSenderSubmit")
            if model.target.action == .create {
                Button("Edit invitation") { model.edit() }.frame(minHeight: 44).accessibilityIdentifier("homeInvitationSenderEdit")
            }
        }
    }

    private func recovery(_ original: PendingHomeInvitationSender) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Action: \(actionName(original.action))")
                .accessibilityIdentifier("homeInvitationSenderOriginalAction")
            Text(original.recipient).accessibilityIdentifier("homeInvitationSenderOriginalRecipient")
            if original.homeId != model.homeId {
                Text("This is for another of your Homes. Finish it before inviting someone here.")
            }
            if let outcome = original.outcome, outcome.isTerminal {
                if outcome.state == "completed" {
                    Text(completedMessage(original.action))
                    if original.action != .withdraw {
                        Text(outcome.deliveryMessage).accessibilityIdentifier("homeInvitationSenderDelivery")
                        control("Get invitation link", "homeInvitationSenderCheckSharing") {
                            await model.checkSharing(requestId: original.requestId)
                        }
                        if model.shareURL != nil {
                            control("Share invitation link", "homeInvitationSenderShare") {
                                if let url = await model.prepareShare(requestId: original.requestId, lifetime: model.generation) {
                                    sharing = Sharing(url: url)
                                }
                            }
                        }
                    }
                } else {
                    Text(
                        outcome.state == "cancelled" ? cancelledMessage : HomeInvitationSenderError.message(outcome.code)
                    )
                }
                control("Done", "homeInvitationSenderAcknowledge") {
                    if let acknowledged = await model.acknowledge(requestId: original.requestId) { onClose(acknowledged) }
                }
            } else {
                Text(
                    "We couldn't confirm whether this went through. Check again, or try again. "
                        + "Trying again won't send a second email."
                )
                control("Check again", "homeInvitationSenderCheck") {
                    await model.recover(.check, requestId: original.requestId, lifetime: model.generation)
                }
                control("Try again", "homeInvitationSenderRetry") {
                    await model.recover(.retry, requestId: original.requestId, lifetime: model.generation)
                }
                Button("Discard attempt", role: .destructive) {
                    confirmation = Confirmation(token: "", requestId: original.requestId, lifetime: model.generation)
                }.frame(minHeight: 44).disabled(model.isWorking).accessibilityIdentifier("homeInvitationSenderCancel")
            }
        }
    }

    private func control(_ label: String, _ identifier: String, action: @escaping () async -> Void) -> some View {
        Button(label) { Task { await action() } }.frame(minHeight: 44).disabled(model.isWorking).accessibilityIdentifier(identifier)
    }

    private var cancellationMessage: String {
        "If it already went through, it stays. "
            + "Discarding doesn't withdraw an invitation or remove anyone."
    }

    private var cancelledMessage: String {
        "Nothing changed. This attempt was discarded before it took effect."
    }

    private var submitLabel: String {
        switch model.target.action {
        case .withdraw: "Withdraw invitation"
        case .resend: "Resend invitation"
        case .create: "Send invitation"
        }
    }

    private func dateLabel(_ key: String) -> String {
        switch key {
        case "expires_at": "Invitation expires"
        case "access_start_at": "Access begins"
        default: "Access ends"
        }
    }
}

private extension InviteMemberWizardView {
    func completedMessage(_ action: HomeInvitationSenderAction?) -> String {
        switch action {
        case .withdraw: "They can no longer accept it. Anyone already in the household stays."
        case .resend: "Links already sent keep working, and the expiry date hasn't changed."
        default: "They join the household when they accept. Until then, it's listed under Pending in Members."
        }
    }

    func actionName(_ action: HomeInvitationSenderAction?) -> String {
        switch action {
        case .withdraw: "Withdraw invitation"
        case .resend: "Resend invitation"
        case .create: "Send invitation"
        case nil: "Invitation"
        }
    }

    /// A preset names the relationship chosen on the web (e.g. "Tenant"); the role alone covers invitations without one.
    func presetLine(_ key: String?) -> String? {
        guard let key else { return nil }
        if key.hasPrefix("access_request:") { return "Approved from a request to join" }
        return "Relationship: " + HomeInvitationSenderValidation.presetLabel(key)
    }
}

private struct HomeInvitationSenderActivity: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context _: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }

    func updateUIViewController(_: UIActivityViewController, context _: Context) {}
}
