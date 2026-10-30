//
//  MailLetterActions.swift
//  Pantopus
//
//  What can be done with a piece (Mail tab drawings, board "R5-Bill"): Pay
//  a bill that's owed, Acknowledge when the sender asks, then the counter,
//  the Vault and the shredder (`POST /api/mailbox/v2/item/:id/action`).
//

import SwiftUI

/// The letter page's actions, as the server names them where it has one.
enum MailLetterAction: String, Identifiable {
    case pay
    case acknowledge
    case counter
    case done
    case file
    case unfile
    case shred

    var id: String {
        rawValue
    }
}

struct MailLetterActions: View {
    let letter: MailLetter
    /// The action on its way, if any; the others wait.
    let inFlight: MailLetterAction?
    /// Shredded (or dismissed for the household): only Bring it back.
    let removed: MailRemovedDTO?
    let restoreInFlight: Bool
    let onAction: (MailLetterAction) -> Void
    let onRestore: () -> Void

    var body: some View {
        if let removed {
            shredded(removed)
        } else {
            actions
        }
    }

    /// "Shredded by Rowan A. · You can bring it back until Nov 26."
    private func shredded(_ removed: MailRemovedDTO) -> some View {
        let text = MailDetailViewModel.shreddedText(removed)
        return VStack(spacing: 10) {
            VStack(spacing: 2) {
                Text(text.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(text.subtitle)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .multilineTextAlignment(.center)
            .accessibilityElement(children: .combine)
            PantopusButton(title: "Bring it back", kind: .primary, isLoading: restoreInFlight) { onRestore() }
                .accessibilityIdentifier("mailLetterRestore")
        }
        .accessibilityIdentifier("mailLetterShredded")
    }

    private var actions: some View {
        VStack(spacing: 10) {
            if letter.payable != nil {
                PantopusButton(title: letter.payLabel, kind: .primary, isLoading: inFlight == .pay, isEnabled: inFlight == nil) {
                    onAction(.pay)
                }
                .accessibilityIdentifier("mailLetterPay")
            } else if letter.isPaid {
                Label {
                    Text("Paid")
                } icon: {
                    Icon(.checkCircle, size: 16, strokeWidth: 2.25, color: Theme.Color.success)
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.Color.success)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(Theme.Color.successBg, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                .accessibilityIdentifier("mailLetterPaid")
            }
            if letter.asksAcknowledgement {
                if letter.isAcknowledged {
                    Label {
                        Text("Acknowledged")
                    } icon: {
                        Icon(.badgeCheck, size: 16, strokeWidth: 2.25, color: Theme.Color.success)
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.success)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .accessibilityIdentifier("mailLetterAcknowledged")
                } else {
                    PantopusButton(
                        title: "Acknowledge",
                        kind: letter.payable == nil ? .primary : .ghost,
                        isLoading: inFlight == .acknowledge,
                        isEnabled: inFlight == nil
                    ) { onAction(.acknowledge) }
                        .accessibilityIdentifier("mailLetterAcknowledge")
                }
            }
            HStack(spacing: Spacing.s2) {
                if letter.isFiled {
                    // Filed mail comes back to Incoming before the counter.
                    tile(.unfile, icon: .undo2, title: "Take out of the Vault", isPressed: false)
                } else {
                    // A Christmas card is nothing to do: no counter for it.
                    if letter.card == nil {
                        if letter.onCounter {
                            tile(.done, icon: .inbox, title: "On the counter", isPressed: true)
                        } else {
                            tile(.counter, icon: .inbox, title: "Put on the counter", isPressed: false)
                        }
                    }
                    tile(.file, icon: .archive, title: "File in the Vault", isPressed: false)
                }
                tile(.shred, icon: .scissors, title: "Shred", isPressed: false)
            }
        }
    }

    private func tile(_ action: MailLetterAction, icon: PantopusIcon, title: String, isPressed: Bool) -> some View {
        let ink = isPressed ? Theme.Color.info : Theme.Color.appTextStrong
        return Button { onAction(action) } label: {
            VStack(spacing: 3) {
                if inFlight == action {
                    ProgressView().frame(width: 18, height: 18)
                } else {
                    Icon(icon, size: 18, color: ink)
                }
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(ink)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
            }
            .padding(.horizontal, Spacing.s1)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(
                isPressed ? Theme.Color.infoBg : Theme.Color.appSurface,
                in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(isPressed ? Theme.Color.infoLight : Theme.Color.appBorder, lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(inFlight != nil)
        .accessibilityLabel(title)
        .accessibilityHint(hint(action))
        .accessibilityAddTraits(isPressed ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("mailLetterAction.\(action.rawValue)")
    }

    private func hint(_ action: MailLetterAction) -> String {
        switch action {
        case .counter: "Keeps it where you'll see it until it's done."
        case .done: "Asks whether you're done with it."
        case .file: "Choose a folder for it."
        case .unfile: "Puts it back in Incoming."
        case .shred: "Asks before shredding."
        case .pay, .acknowledge: ""
        }
    }
}
