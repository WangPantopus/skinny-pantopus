//
//  SystemSheets.swift
//  Pantopus
//
//  P6.6 — Reusable UIKit-backed system surfaces used by the placeholder
//  sweep: the share sheet (`UIActivityViewController`), the mail composer
//  (`MFMailComposeViewController`, with a `mailto:` fallback), and the
//  system contacts picker (`CNContactPickerViewController`). Centralising
//  them here keeps "Share …", "Invite …", and "Find people" on one
//  payload + one presentation path on both the Hub and You stacks.
//

import ContactsUI
import MessageUI
import SwiftUI
import UIKit

// MARK: - Invite copy / links

/// Single source of truth for the invite message + download link shared by
/// "Invite to Pantopus" and the post-contact-pick invite. Swap
/// `downloadURLString` for the real App Store / Play Store smart-link when
/// it ships — every invite surface reads from here.
public enum InviteLinks {
    public static let downloadURLString = "https://pantopus.app"

    public static var downloadURL: URL? {
        URL(string: downloadURLString)
    }

    public static let inviteMessage =
        "Join me on Pantopus — your neighborhood for trusted home help, " +
        "local gigs, and your whole household in one place. \(downloadURLString)"

    /// Items handed to `UIActivityViewController` for an invite share.
    public static var shareItems: [Any] {
        var items: [Any] = [inviteMessage]
        if let url = downloadURL { items.append(url) }
        return items
    }
}

// MARK: - Share sheet

/// SwiftUI wrapper over `UIActivityViewController`. `items` accepts the
/// usual activity-item grab-bag (`String`, `URL`, `Data`, file URLs for a
/// PDF, …).
public struct SystemShareSheet: UIViewControllerRepresentable {
    private let items: [Any]

    public init(items: [Any]) {
        self.items = items
    }

    public func makeUIViewController(context _: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    public func updateUIViewController(_: UIActivityViewController, context _: Context) {}
}

// MARK: - Mail compose

/// Draft payload for the system mail composer. Carries a `mailtoURL`
/// fallback for devices with no configured Mail account.
public struct MailDraft: Identifiable, Hashable, Sendable {
    public let id = UUID()
    public let recipients: [String]
    public let subject: String
    public let body: String

    public init(recipients: [String] = [], subject: String, body: String) {
        self.recipients = recipients
        self.subject = subject
        self.body = body
    }

    /// `true` when the device has at least one Mail account configured.
    @MainActor public static var canSendMail: Bool {
        MFMailComposeViewController.canSendMail()
    }

    /// `mailto:` URL used as a fallback when `canSendMail` is false.
    public var mailtoURL: URL? {
        var comps = URLComponents()
        comps.scheme = "mailto"
        comps.path = recipients.joined(separator: ",")
        comps.queryItems = [
            URLQueryItem(name: "subject", value: subject),
            URLQueryItem(name: "body", value: body)
        ]
        return comps.url
    }
}

/// SwiftUI wrapper over `MFMailComposeViewController`. Present only when
/// `MailDraft.canSendMail` is true; otherwise open `mailtoURL`.
public struct MailComposeSheet: UIViewControllerRepresentable {
    private let draft: MailDraft
    private let onFinish: @MainActor @Sendable () -> Void

    public init(draft: MailDraft, onFinish: @escaping @MainActor @Sendable () -> Void = {}) {
        self.draft = draft
        self.onFinish = onFinish
    }

    public func makeUIViewController(context: Context) -> MFMailComposeViewController {
        let controller = MFMailComposeViewController()
        controller.mailComposeDelegate = context.coordinator
        controller.setToRecipients(draft.recipients)
        controller.setSubject(draft.subject)
        controller.setMessageBody(draft.body, isHTML: false)
        return controller
    }

    public func updateUIViewController(_: MFMailComposeViewController, context _: Context) {}

    public func makeCoordinator() -> Coordinator {
        Coordinator(onFinish: onFinish)
    }

    public final class Coordinator: NSObject, MFMailComposeViewControllerDelegate {
        private let onFinish: @MainActor @Sendable () -> Void

        init(onFinish: @escaping @MainActor @Sendable () -> Void) {
            self.onFinish = onFinish
        }

        public func mailComposeController(
            _ controller: MFMailComposeViewController,
            didFinishWith _: MFMailComposeResult,
            error _: (any Error)?
        ) {
            let onFinish = onFinish
            Task { @MainActor in
                controller.dismiss(animated: true)
                onFinish()
            }
        }
    }
}

// MARK: - Contacts picker

/// A contact the user selected from the system picker.
public struct PickedContact: Hashable, Sendable {
    public let name: String
    public let phone: String?
    public let email: String?
}

/// SwiftUI wrapper over `CNContactPickerViewController`. Presenting the
/// picker does not require `NSContactsUsageDescription` — selection runs
/// out-of-process and only the chosen contact is returned.
public struct ContactPickerSheet: UIViewControllerRepresentable {
    private let onPicked: (PickedContact) -> Void
    private let onCancel: () -> Void

    public init(
        onPicked: @escaping (PickedContact) -> Void,
        onCancel: @escaping () -> Void = {}
    ) {
        self.onPicked = onPicked
        self.onCancel = onCancel
    }

    public func makeUIViewController(context: Context) -> CNContactPickerViewController {
        let picker = CNContactPickerViewController()
        picker.delegate = context.coordinator
        return picker
    }

    public func updateUIViewController(_: CNContactPickerViewController, context _: Context) {}

    public func makeCoordinator() -> Coordinator {
        Coordinator(onPicked: onPicked, onCancel: onCancel)
    }

    public final class Coordinator: NSObject, CNContactPickerDelegate {
        private let onPicked: (PickedContact) -> Void
        private let onCancel: () -> Void

        init(
            onPicked: @escaping (PickedContact) -> Void,
            onCancel: @escaping () -> Void
        ) {
            self.onPicked = onPicked
            self.onCancel = onCancel
        }

        public func contactPicker(_: CNContactPickerViewController, didSelect contact: CNContact) {
            let name = CNContactFormatter.string(from: contact, style: .fullName) ?? ""
            onPicked(PickedContact(
                name: name,
                phone: contact.phoneNumbers.first?.value.stringValue,
                email: contact.emailAddresses.first.map { $0.value as String }
            ))
        }

        public func contactPickerDidCancel(_: CNContactPickerViewController) {
            onCancel()
        }
    }
}

// MARK: - Shared request enum for share / mail

/// Identifiable wrapper so a host can drive a single `.sheet(item:)` for
/// either a share or a mail-compose surface.
public enum SystemSheetRequest: Identifiable {
    case share(items: [Any])
    case mail(MailDraft)

    public var id: String {
        switch self {
        case .share: "share"
        case let .mail(draft): "mail-\(draft.id.uuidString)"
        }
    }

    @MainActor @ViewBuilder
    public func makeView() -> some View {
        switch self {
        case let .share(items):
            SystemShareSheet(items: items)
        case let .mail(draft):
            MailComposeSheet(draft: draft)
        }
    }
}

// MARK: - Find-people modifier (contacts picker → invite share)

private struct FindPeopleSheetModifier: ViewModifier {
    @Binding var isPresented: Bool
    @State private var pendingInvite = false
    @State private var showInvite = false

    func body(content: Content) -> some View {
        content
            .sheet(
                isPresented: $isPresented,
                onDismiss: {
                    if pendingInvite {
                        pendingInvite = false
                        showInvite = true
                    }
                },
                content: {
                    ContactPickerSheet(
                        onPicked: { _ in
                            pendingInvite = true
                            isPresented = false
                        },
                        onCancel: { isPresented = false }
                    )
                }
            )
            .sheet(isPresented: $showInvite) {
                SystemShareSheet(items: InviteLinks.shareItems)
            }
    }
}

public extension View {
    /// Presents the system contacts picker; once the user picks someone,
    /// follows with the invite share sheet so "Find people" ends in a real
    /// invite rather than a dead-end.
    func findPeopleSheet(isPresented: Binding<Bool>) -> some View {
        modifier(FindPeopleSheetModifier(isPresented: isPresented))
    }
}
