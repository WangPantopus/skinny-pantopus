//
//  PlaceBlockInviteForm.swift
//  Pantopus
//
//  The Block Founders invite composer. Split out of
//  PlaceBlockFoundersSection.swift for the 500-line file budget.
//
//  The three promises in this form's copy are enforced by the backend,
//  and the UI must never imply otherwise:
//    1. Pantopus writes and mails a fixed card — the sender chooses the
//       address and nothing else. There is no message field, and there
//       must never look like there is one.
//    2. The sender is identified only as a neighbor on their street —
//       never by name, never by house number.
//    3. Every card carries a working opt-out that silences that address
//       permanently, for every sender.
//

import SwiftUI

// swiftlint:disable line_length

struct BlockInviteForm: View {
    @Bindable var vm: PlaceBlockFoundersViewModel
    let status: BlockStatus

    /// Nil means the server didn't report a budget — never "none left".
    private var outOfBudget: Bool {
        (status.invitesRemaining ?? 1) <= 0
    }

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 11) {
                header
                promises
                fields
                if let inviteError = vm.inviteError {
                    Text(inviteError)
                        .font(.system(size: 12.5))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.error)
                        .accessibilityIdentifier("place.blockFounders.inviteError")
                }
                if let inviteSent = vm.inviteSent {
                    Text(inviteSent)
                        .font(.system(size: 12.5, weight: .medium))
                        .foregroundStyle(Theme.Color.success)
                        .accessibilityIdentifier("place.blockFounders.inviteSent")
                }
                sendButton
                Text(budgetLine)
                    .font(.system(size: 11.5))
                    .foregroundStyle(outOfBudget ? Theme.Color.warning : Theme.Color.appTextMuted)
            }
        }
        .accessibilityIdentifier("place.blockFounders.inviteForm")
    }

    private var header: some View {
        HStack(spacing: 11) {
            PlaceIconTile(icon: .mailbox, tone: .sky, size: 34)
            Text("Invite a neighbor by mail")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Spacer(minLength: 0)
        }
    }

    private var promises: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("You choose the address. Pantopus writes and mails the card — there's no message to write, and the wording is the same on every one.")
                .font(.system(size: 12.5))
                .lineSpacing(2)
                .foregroundStyle(Theme.Color.appTextSecondary)
            promise("You're named only as a neighbor on your street — never your name, never your house number.")
            promise("Every card carries a working opt-out. One use silences that address for good, from every sender.")
            promise("One card per address per season, from anyone — an address already on Pantopus is never mailed.")
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurfaceSunken, in: RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    private func promise(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 7) {
            Icon(.check, size: 13, strokeWidth: 2.5, color: Theme.Color.home)
                .padding(.top, 2)
            Text(text)
                .pantopusTextStyle(.caption)
                .lineSpacing(2)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private var fields: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            field(label: "Street address", placeholder: "1425 SE Oak St", text: $vm.recipientLine1)
            field(label: "City", placeholder: "Portland", text: $vm.recipientCity)
            HStack(spacing: Spacing.s2) {
                field(label: "State", placeholder: "OR", text: $vm.recipientState)
                    .frame(maxWidth: 96)
                field(label: "ZIP", placeholder: "97214", text: $vm.recipientZip)
            }
        }
    }

    private func field(label: String, placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased())
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextMuted)
            TextField(placeholder, text: text)
                .textFieldStyle(.roundedBorder)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.words)
                .font(.system(size: 15))
        }
    }

    private var sendButton: some View {
        Button {
            Task { await vm.sendInvite() }
        } label: {
            Text(vm.isSending ? "Sending…" : "Send the card")
                .font(.system(size: 14.5, weight: .semibold))
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .disabled(!vm.canSend || outOfBudget)
    }

    private var budgetLine: String {
        let cap = status.invitesWeeklyCap ?? 3
        // A missing budget is stated as a cap, never as "0 left" — that
        // would read as a block on a resident who has sent nothing.
        guard let left = status.invitesRemaining else {
            return "Invitations are capped at \(cap) a week."
        }
        if outOfBudget {
            return "No invitations left this week. The cap is \(cap) a week — your budget resets in a week."
        }
        let noun = left == 1 ? "invitation" : "invitations"
        return "\(left) of \(cap) \(noun) left this week."
    }
}
