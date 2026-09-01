//
//  ConnectWebPresenter.swift
//  Pantopus
//
//  Block 3C — presents Stripe-hosted Connect pages (the Account Link
//  onboarding flow and the Express dashboard) in an in-app
//  `SFSafariViewController`. Onboarding is entirely Stripe-hosted (bank /
//  identity / KYC); we only open the URL and, when the seller returns
//  (dismisses the browser), the caller re-reads `/connect/account` to reflect
//  the new payouts-enabled state. Abstracted behind a protocol so the wallet
//  view-model stays unit-testable with a stub.
//

import SafariServices
import UIKit

@MainActor
public protocol ConnectWebPresenting: Sendable {
    /// Present `url` in an in-app browser and resolve when the seller
    /// dismisses it (returns to the app). For onboarding the caller then
    /// refreshes Connect status; for the dashboard there's nothing to refresh.
    func present(url: URL) async
}

@MainActor
public final class ConnectWebPresenter: NSObject, ConnectWebPresenting, SFSafariViewControllerDelegate {
    private var continuation: CheckedContinuation<Void, Never>?

    override public init() {
        super.init()
    }

    public func present(url: URL) async {
        guard let host = Self.topViewController() else { return }
        await withCheckedContinuation { continuation in
            self.continuation = continuation
            let safari = SFSafariViewController(url: url)
            safari.delegate = self
            host.present(safari, animated: true)
        }
    }

    public func safariViewControllerDidFinish(_: SFSafariViewController) {
        continuation?.resume()
        continuation = nil
    }

    // MARK: - Presentation host (mirrors StripePaymentSheetPresenter)

    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes
        let windowScene = (scenes.first { $0.activationState == .foregroundActive } as? UIWindowScene)
            ?? scenes.first as? UIWindowScene
        let window = windowScene?.windows.first { $0.isKeyWindow } ?? windowScene?.windows.first
        guard let root = window?.rootViewController else { return nil }
        return topMost(of: root)
    }

    private static func topMost(of controller: UIViewController) -> UIViewController {
        if let presented = controller.presentedViewController {
            return topMost(of: presented)
        }
        if let nav = controller as? UINavigationController, let visible = nav.visibleViewController {
            return topMost(of: visible)
        }
        if let tab = controller as? UITabBarController, let selected = tab.selectedViewController {
            return topMost(of: selected)
        }
        return controller
    }
}
