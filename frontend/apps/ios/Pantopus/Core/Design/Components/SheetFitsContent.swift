//
//  SheetFitsContent.swift
//  Pantopus
//
//  A short sheet is as tall as what it says, on an iPad. iPadOS shows a sheet
//  with detents along the bottom of the screen, and on an iPad's tall screen
//  the half-screen detent (`.medium`) left most of a short sheet empty: "Your
//  daily briefings" was two-thirds blank on a 13-inch iPad. There the sheet is
//  a form sized to its content instead (Apple's fitted sizing: a card in the
//  middle of the screen, which scrolls when the content is taller than the
//  screen). iPhones, the iPhone Duo included, keep the detents they are given.
//

import SwiftUI
import UIKit

public extension View {
    /// In place of `presentationDetents(_:)` on a sheet: on an iPad the sheet is sized to its content; on iPhones
    /// it keeps `detents`.
    func presentationDetentsFittingContentOnIPad(_ detents: Set<PresentationDetent>) -> some View {
        modifier(SheetFitsContentOnIPad(detents: detents))
    }
}

private struct SheetFitsContentOnIPad: ViewModifier {
    let detents: Set<PresentationDetent>

    func body(content: Content) -> some View {
        if #available(iOS 18.0, *), UIDevice.current.userInterfaceIdiom == .pad {
            content.presentationSizing(.form.fitted(horizontal: false, vertical: true))
        } else {
            content.presentationDetents(detents)
        }
    }
}
