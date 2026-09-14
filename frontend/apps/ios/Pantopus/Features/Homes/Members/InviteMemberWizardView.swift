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
                    control("Reopen invitation recovery", "homeInvitationSenderReopen") { await model.open() }
                }
                Button("Close") { onClose(nil) }.frame(minHeight: 44).accessibilityIdentifier("homeInvitationSenderClose")
                Text("An invitation offers household access under its role and dates. It does not verify residency or ownership. "
                    + "Saved invitation actions and message delivery are separate.")
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
            confirmation?.requestId == nil ? confirmationTitle : "Cancel the original attempt?",
            isPresented: Binding(get: { confirmation != nil }, set: { if !$0 { confirmation = nil } }),
            titleVisibility: .visible,
            presenting: confirmation
        ) { selected in
            if let requestId = selected.requestId {
                Button("Confirm cancellation", role: .destructive) {
                    Task { await model.recover(.cancel, requestId: requestId, lifetime: selected.lifetime) }
                }.accessibilityIdentifier("homeInvitationSenderConfirmCancel")
            } else {
                Button(
                    "Confirm \(model.target.action == .withdraw ? "withdrawal" : model.target.action == .resend ? "resend" : "invitation")",
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
                case .resend: return "Resend saved"
                default: return "Invitation saved"
                }
            case "cancelled": return "Attempt cancelled"
            case "rejected": return "Action did not proceed"
            default: return "Recover original invitation action"
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
        case .create: "Create this invitation?"
        }
    }

    private var confirmationMessage: String {
        switch model.target.action {
        case .create: "The recipient can accept the reviewed household access. Delivery will be reported separately."
        case .resend: "This requests another delivery for the same invitation. "
            + "Existing links and access dates remain valid; expiry is not extended."
        case .withdraw: "This prevents future acceptance of this pending invitation. Existing membership is not removed."
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
            Picker("Household role", selection: $model.role) {
                Text("Member").tag("member")
                Text("Guest").tag("guest")
            }.pickerStyle(.segmented).accessibilityIdentifier("homeInvitationSenderRole")
            Text("Access depends on the household's current permissions. Guest passes are issued separately from the Guests tab.")
                .pantopusTextStyle(.caption).foregroundStyle(Theme.Color.appTextSecondary)
            Text("Personal note (optional)").pantopusTextStyle(.caption)
            TextEditor(text: $model.message).frame(minHeight: 80)
                .accessibilityIdentifier("inviteMember_message")
            control("Review invitation", "homeInvitationSenderPrepare") { await model.prepare() }
        }
    }

    private func review(_ context: HomeInvitationSenderContext) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Review current invitation details").pantopusTextStyle(.h3)
            if model.target.action == .create, let payload = context.intent.dictValue?["payload"]?.dictValue {
                Text(payload["email"]?.stringValue ?? "").accessibilityIdentifier("homeInvitationSenderRecipient")
                Text("Role: \(payload["relationship"]?.stringValue ?? "")")
                Text("Preset: \(HomeInvitationSenderValidation.presetLabel(payload["preset_key"]?.stringValue))")
                if let note = payload["message"]?.stringValue { Text(note) }
            } else {
                Text(context.invitation["invitee"]?.dictValue.map(HomeInvitationSenderValidation.profileLabel)
                    ?? context.invitation["invitee_email"]?.stringValue ?? "Selected account")
                    .accessibilityIdentifier("homeInvitationSenderRecipient")
                let role = HomeInvitationSenderValidation.effectiveRole(context.invitation) ?? "Invitation access"
                Text("Role: \(role)")
                Text("Preset: \(HomeInvitationSenderValidation.presetLabel(context.invitation["proposed_preset_key"]?.stringValue))")
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
            Text("Original action: \(original.action?.rawValue ?? "invitation")")
                .accessibilityIdentifier("homeInvitationSenderOriginalAction")
            Text(original.recipient).accessibilityIdentifier("homeInvitationSenderOriginalRecipient")
            if original.homeId != model.homeId {
                Text("This retained original belongs to another Home. It must be resolved before starting an action for this Home.")
            }
            if let outcome = original.outcome, outcome.isTerminal {
                if outcome.state == "completed" {
                    Text(original.action == .withdraw ? "The invitation was withdrawn. Existing membership was not changed."
                        : "The invitation action is saved. A member-list refresh cannot change that result.")
                    if original.action != .withdraw {
                        Text(outcome.deliveryMessage).accessibilityIdentifier("homeInvitationSenderDelivery")
                        control("Check link for sharing", "homeInvitationSenderCheckSharing") {
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
                control("Acknowledge result", "homeInvitationSenderAcknowledge") {
                    if let acknowledged = await model.acknowledge(requestId: original.requestId) { onClose(acknowledged) }
                }
            } else {
                Text(
                    "Keep this original until its saved result or cancellation is confirmed. "
                        + "A retry uses the same request and cannot resend delivery."
                )
                control("Check original result", "homeInvitationSenderCheck") {
                    await model.recover(.check, requestId: original.requestId, lifetime: model.generation)
                }
                control("Retry original action", "homeInvitationSenderRetry") {
                    await model.recover(.retry, requestId: original.requestId, lifetime: model.generation)
                }
                Button("Cancel original attempt", role: .destructive) {
                    confirmation = Confirmation(token: "", requestId: original.requestId, lifetime: model.generation)
                }.frame(minHeight: 44).disabled(model.isWorking).accessibilityIdentifier("homeInvitationSenderCancel")
            }
        }
    }

    private func control(_ label: String, _ identifier: String, action: @escaping () async -> Void) -> some View {
        Button(label) { Task { await action() } }.frame(minHeight: 44).disabled(model.isWorking).accessibilityIdentifier(identifier)
    }

    private var cancellationMessage: String {
        "A saved result wins if this action already completed. "
            + "Cancelling an attempt does not withdraw an invitation or change membership."
    }

    private var cancelledMessage: String {
        "The original attempt was cancelled. The invitation and existing membership were not changed."
    }

    private var submitLabel: String {
        switch model.target.action {
        case .withdraw: "Withdraw invitation"
        case .resend: "Request resend"
        case .create: "Create invitation"
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

private struct HomeInvitationSenderActivity: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context _: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }

    func updateUIViewController(_: UIActivityViewController, context _: Context) {}
}
