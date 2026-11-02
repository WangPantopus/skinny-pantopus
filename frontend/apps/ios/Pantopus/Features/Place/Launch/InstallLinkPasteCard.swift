//
//  InstallLinkPasteCard.swift
//  Pantopus
//
//  A link tapped before Pantopus was installed opens its web page, and the
//  App Store opens the new app with nothing from it. The page's app buttons
//  copy the link on the way to the App Store (web `StoreLink.tsx`); this card
//  on the first screen offers it back with Apple's Paste button, which reads
//  the clipboard only when it's tapped, so iOS shows no paste alert. Android
//  gets the same link from Google Play's install referrer
//  (`InstallReferrerLink.kt`).
//

import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// Whether the first screen offers a copied link back, and what a paste did.
@Observable
@MainActor
final class InstallLinkPaste {
    static let shared = InstallLinkPaste()

    /// The card is up: nobody has signed in on this install yet, no link is
    /// already waiting, and the clipboard holds a web link.
    private(set) var isOffered = false
    /// Why the last paste didn't open anything, shown on the card.
    private(set) var problem: String?

    /// Set once the card has done its job: a link opened from it, it was
    /// closed, or someone signed in on this install. Kept with the app's
    /// data, so a reinstall offers it again.
    private static let retiredKey = "pantopus.installLinkPaste.retired"

    private init() {}

    static var isRetired: Bool {
        UserDefaults.standard.bool(forKey: retiredKey)
    }

    /// Ends the offer on this install; the first sign-in calls it too.
    static func retire() {
        UserDefaults.standard.set(true, forKey: retiredKey)
        shared.isOffered = false
        shared.problem = nil
    }

    /// Asks iOS whether the clipboard holds a web link. That doesn't read
    /// the clipboard, so iOS shows nothing.
    func refresh() async {
        guard !Self.isRetired, PendingDeepLinkStore.peek() == nil, DeepLinkRouter.shared.pending == nil else {
            isOffered = false
            return
        }
        let patterns = try? await UIPasteboard.general.detectedPatterns(for: [\.probableWebURL])
        // A sign-in or a tapped link may have arrived while iOS answered.
        guard !Self.isRetired else { return }
        isOffered = patterns?.contains(\.probableWebURL) == true || problem != nil
    }

    /// Opens what Paste delivered, when it's a Pantopus link this app opens.
    func open(pasted text: String?) {
        guard let url = text.flatMap(Self.firstLink(in:)) else {
            problem = "That isn't a link. Copy the Pantopus link you were sent, then tap Paste."
            return
        }
        guard Self.isPantopusLink(url) else {
            problem = "That isn't a Pantopus link."
            return
        }
        guard DeepLinkRouter.shared.canResolve(path: url.absoluteString) else {
            problem = "This version of Pantopus can't open that link."
            return
        }
        Self.retire()
        // As if the link had been tapped: a friend's invite opens Create
        // account with its code, anything else waits for sign-in.
        DeepLinkRouter.shared.handle(url: url)
    }

    /// The card's X.
    func dismiss() {
        Self.retire()
    }

    /// The first web link in the pasted text; a copied message can carry
    /// words around it.
    static func firstLink(in text: String) -> URL? {
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else {
            return nil
        }
        let range = NSRange(text.startIndex..., in: text)
        return detector.matches(in: text, range: range).lazy
            .compactMap(\.url)
            .first { ["http", "https"].contains($0.scheme?.lowercased() ?? "") }
    }

    /// A pantopus.com link, or one on this build's own web (a local or
    /// staging build shares those). Any other site's page is never opened
    /// as a Pantopus screen.
    static func isPantopusLink(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased() else { return false }
        if scheme == "https", WebLinkFallback.hosts.contains(host) { return true }
        guard let site = URL(string: InviteLinks.siteURLString) else { return false }
        return site.scheme?.lowercased() == scheme && site.host?.lowercased() == host && site.port == url.port
    }

    /// The text Paste delivered: a link, or plain text that may hold one.
    nonisolated static func loadText(from providers: [NSItemProvider], completion: @escaping @Sendable (String?) -> Void) {
        guard let provider = providers.first else { return completion(nil) }
        if provider.canLoadObject(ofClass: URL.self) {
            _ = provider.loadObject(ofClass: URL.self) { url, _ in completion(url?.absoluteString) }
        } else if provider.canLoadObject(ofClass: String.self) {
            _ = provider.loadObject(ofClass: String.self) { text, _ in completion(text) }
        } else {
            completion(nil)
        }
    }
}

/// The first screen's offer to open a link copied before the install.
struct InstallLinkPasteCard: View {
    private let paste = InstallLinkPaste.shared

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Theme.Color.primary50)
                    Icon(.link, size: 16, strokeWidth: 2, color: Theme.Color.primary600)
                }
                .frame(width: 32, height: 32)
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Opened a Pantopus link before installing?")
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("Tap Paste to pick up where you left off.")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                Button {
                    paste.dismiss()
                } label: {
                    Icon(.x, size: 16, strokeWidth: 2, color: Theme.Color.appTextMuted)
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
                .accessibilityIdentifier("place.launch.installLink.close")
            }
            // Apple's own button: the app sees the clipboard only when it's tapped.
            PasteButton(supportedContentTypes: [.url, .plainText]) { providers in
                InstallLinkPaste.loadText(from: providers) { text in
                    Task { @MainActor in InstallLinkPaste.shared.open(pasted: text) }
                }
            }
            .buttonBorderShape(.capsule)
            .labelStyle(.titleAndIcon)
            .tint(Theme.Color.primary600)
            .accessibilityIdentifier("place.launch.installLink.paste")
            if let problem = paste.problem {
                Text(problem)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.error)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("place.launch.installLink.problem")
            }
        }
        .padding(14)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("place.launch.installLink")
    }
}

extension View {
    /// Checks the clipboard for a link to offer when the first screen shows
    /// and whenever the app comes back (someone who went to copy the link).
    func refreshesInstallLinkPaste(_ enabled: Bool) -> some View {
        modifier(InstallLinkPasteRefresh(enabled: enabled))
    }
}

private struct InstallLinkPasteRefresh: ViewModifier {
    let enabled: Bool
    @Environment(\.scenePhase) private var scenePhase

    func body(content: Content) -> some View {
        content
            .task(id: enabled) {
                if enabled { await InstallLinkPaste.shared.refresh() }
            }
            .onChange(of: scenePhase) { _, phase in
                guard enabled, phase == .active else { return }
                Task { await InstallLinkPaste.shared.refresh() }
            }
    }
}
