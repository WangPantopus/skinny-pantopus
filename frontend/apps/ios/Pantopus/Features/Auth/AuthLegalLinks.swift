//
//  AuthLegalLinks.swift
//  Pantopus
//
//  Signed-out legal affordances. RN renders Terms of Service and Privacy
//  Policy as *individually tappable* runs inside the consent sentence —
//  tapping either one pushes the matching legal screen and deliberately
//  does **not** toggle the acceptance checkbox
//  (`pantopus/frontend/apps/mobile/src/app/(auth)/register.tsx:303-341`,
//  `login.tsx:277-293`). Natively the same sentence was flat, unstyled
//  text, so the documents were unreachable before sign-in.
//
//  The links are modelled as `pantopus://legal/<doc>` URLs carried inside
//  an `AttributedString`, so the sentence still wraps as one paragraph.
//  `legalLinkHandler(_:)` intercepts them via `OpenURLAction` and hands
//  the caller a `LegalDocument` instead of letting the system open a URL.
//

import SwiftUI

/// URL scheme + parsing for the in-sentence legal links.
enum AuthLegalLink {
    /// Scheme-only host used by the in-text links. Never leaves the app.
    static let scheme = "pantopus"
    static let host = "legal"

    /// `pantopus://legal/terms` / `pantopus://legal/privacy`.
    static func url(for document: LegalDocument) -> URL? {
        URL(string: "\(scheme)://\(host)/\(document.rawValue)")
    }

    /// Reverse of `url(for:)` — `nil` when the URL isn't one of ours, so
    /// the caller can fall through to `.systemAction`.
    static func document(for url: URL) -> LegalDocument? {
        guard url.scheme == scheme, url.host == host else { return nil }
        let slug = url.lastPathComponent
        return LegalDocument.allCases.first { $0.rawValue == slug }
    }

    /// One tappable run. Falls back to plain text if the URL can't be
    /// built (it always can — this keeps the call site force-unwrap free).
    static func run(_ title: String, _ document: LegalDocument) -> AttributedString {
        var run = AttributedString(title)
        run.link = url(for: document)
        run.foregroundColor = Theme.Color.primary600
        return run
    }

    /// "I agree to the Terms and Privacy Policy." — the sign-up consent
    /// sentence, matching RN's `termsText`.
    static var consentSentence: AttributedString {
        AttributedString("I agree to the ")
            + run("Terms", .terms)
            + AttributedString(" and ")
            + run("Privacy Policy", .privacy)
            + AttributedString(".")
    }

    /// "By continuing with Google or Apple, you agree to our Terms of
    /// Service and Privacy Policy." — RN's `oauthTermsText`
    /// (`login.tsx:277-293`).
    static var oauthSentence: AttributedString {
        AttributedString("By continuing with Google or Apple, you agree to our ")
            + run("Terms of Service", .terms)
            + AttributedString(" and ")
            + run("Privacy Policy", .privacy)
            + AttributedString(".")
    }
}

extension View {
    /// Route `pantopus://legal/*` taps to `handler` instead of the system
    /// URL opener. Anything else falls through untouched.
    func legalLinkHandler(_ handler: @escaping (LegalDocument) -> Void) -> some View {
        environment(\.openURL, OpenURLAction { url in
            guard let document = AuthLegalLink.document(for: url) else { return .systemAction }
            handler(document)
            return .handled
        })
    }
}

/// The signed-out OAuth consent line. Rendered under the Google / Apple
/// buttons on both Login and Sign-up, mirroring RN.
struct AuthOAuthTermsLine: View {
    let identifier: String
    let onOpenLegal: (LegalDocument) -> Void

    var body: some View {
        Text(AuthLegalLink.oauthSentence)
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .legalLinkHandler(onOpenLegal)
            .accessibilityIdentifier(identifier)
    }
}
