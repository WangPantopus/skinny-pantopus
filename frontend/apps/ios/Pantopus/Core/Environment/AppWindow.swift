//
//  AppWindow.swift
//  Pantopus
//
//  The size of the window the app shows in: a phone's screen, or an iPad
//  window, which can be smaller than the iPad's screen. Read from the app's
//  window scene, not `UIScreen.main`, which Apple is retiring, which is the
//  whole screen on an iPad, and which is ambiguous on a phone with two screens
//  (iPhone Duo).
//

import UIKit

@MainActor
enum AppWindow {
    /// The app's window height, or nil before its scene is up.
    static var height: CGFloat? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
        return scene?.coordinateSpace.bounds.height
    }
}
