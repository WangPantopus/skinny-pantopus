//
//  PantopusSceneDelegate.swift
//  Pantopus
//
//  The app's window scene, for what only the scene can say about an iPad
//  window: its smallest size, and where iPadOS puts the window buttons (close,
//  minimize, full screen) in a window that isn't full screen. SwiftUI makes the
//  scene's window and still runs `PantopusApp`; this delegate only answers
//  those two questions (`AppDelegate` names it for every scene).
//

import UIKit

final class PantopusSceneDelegate: NSObject, UIWindowSceneDelegate {
    /// An iPad window never gets smaller than an iPhone SE's screen, the
    /// smallest phone the app is laid out for.
    static let smallestWindow = CGSize(width: 375, height: 667)

    func scene(_ scene: UIScene, willConnectTo _: UISceneSession, options _: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene,
              windowScene.traitCollection.userInterfaceIdiom == .pad else { return }
        windowScene.sizeRestrictions?.minimumSize = Self.smallestWindow
    }

    #if compiler(>=6.2)
    /// Every screen draws its own header with the side menu, Back or Close at
    /// the top left, where iPadOS 26 and later put the window buttons of a
    /// window that isn't full screen. The minimal style gives the buttons a
    /// slim strip of their own above the app: the window's top safe area grows
    /// by it, so every screen, cover and sheet stays below them. Full screen
    /// there are no buttons and nothing moves; iPhones have none.
    @available(iOS 26.0, *)
    func preferredWindowingControlStyle(for _: UIWindowScene) -> UIWindowScene.WindowingControlStyle {
        .minimal
    }
    #endif
}
