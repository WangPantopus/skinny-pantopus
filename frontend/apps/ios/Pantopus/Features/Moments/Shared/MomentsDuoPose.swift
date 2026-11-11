//
//  MomentsDuoPose.swift
//  Pantopus
//
//  How the iPhone Duo is held, for Moments' Duo layouts (the founder's design
//  "Moments on iPhone Duo", approved 2026-11-11): closed, open flat sideways
//  (and half folded like a book), open held upright, and half folded standing
//  on a table. Read from the screen itself: the fold is a division region
//  (inactive while the Duo lies flat), and closed the side strip is the
//  trailing safe area. Phones report neither, and nothing before iOS 27.1
//  reports regions at all, so they're always `.phone` and keep their layouts.
//

import SwiftUI
import UIKit

/// How the screen is held.
enum MomentsDuoPose: Equatable {
    /// Any iPhone: the phone's layouts, unchanged.
    case phone
    /// The Duo closed: the outer screen, the phone's design in the column beside the side strip.
    case closed
    /// Open sideways, flat or half folded like a book.
    case wide(book: Bool)
    /// Open flat, held upright.
    case upright
    /// Half folded upright, standing on a table: the top half stands, the bottom half lies flat.
    case table

    /// Open sideways (flat or like a book): the map fills the screen and watching is a card beside it.
    var isWide: Bool {
        if case .wide = self { return true }
        return false
    }

    /// Open, any way up: the map's one big layout (boards O1, U1).
    var isOpen: Bool {
        switch self {
        case .wide, .upright, .table: true
        case .phone, .closed: false
        }
    }
}

/// What a Duo layout needs to know about the screen, in the screen's own points (its top-left corner is 0, 0).
struct MomentsDuoScreen: Equatable {
    var pose: MomentsDuoPose = .phone
    var size: CGSize = .zero
    var insets = EdgeInsets()
    /// The fold, open (flat or half folded); nil closed and on phones.
    var fold: CGRect?
    /// What the system keeps for itself over the screen: the clock and Wi-Fi block, and closed, the camera circle.
    var occlusions: [CGRect] = []

    /// Closed: the column beside the side strip, as tall as the screen.
    var column: CGRect {
        CGRect(x: 0, y: 0, width: max(size.width - insets.trailing, 0), height: size.height)
    }

    /// Closed: the side strip.
    var strip: CGRect {
        CGRect(x: max(size.width - insets.trailing, 0), y: 0, width: insets.trailing, height: size.height)
    }

    /// The lowest any occlusion region reaches over these columns of the screen; 0 where none does.
    func occludedBottom(from minX: CGFloat, to maxX: CGFloat) -> CGFloat {
        occlusions
            .filter { $0.maxX > minX && $0.minX < maxX }
            .map(\.maxY)
            .max() ?? 0
    }

    // MARK: - Open sideways (boards O2–O6, B1)

    /// The card beside the map: from 7.5 pt past the fold to 8 pt before the side strip, 12 pt from the top and the
    /// bottom (boards O2, O3). Like a book it starts past the crease, so nothing in it sits on the fold.
    var card: CGRect {
        let fold = fold ?? CGRect(x: size.width / 2, y: 0, width: 0, height: size.height)
        let minX = fold.maxX + 7.5
        let maxX = size.width - insets.trailing - 8
        return CGRect(x: minX, y: 12, width: max(maxX - minX, 0), height: max(size.height - 24, 0))
    }

    /// The left half: the screen up to the fold.
    var leftHalf: CGRect {
        CGRect(x: 0, y: 0, width: fold?.minX ?? size.width / 2, height: size.height)
    }

    /// Where the map's top row sits from the screen's top (☰, the area and chat): 12 pt closed and open sideways,
    /// where nothing is above it (boards C1, O1); upright beside the clock corner, level with the clock (board U1).
    var topRowTop: CGFloat? {
        switch pose {
        case .phone: nil
        case .closed, .wide: 12
        case .upright, .table: 24
        }
    }

    /// The open Duo held sideways, from the window itself, for a screen outside Moments (a Moment's quote in
    /// Messages, board O11): the fold runs from top to bottom.
    @MainActor
    static var windowIsWide: Bool {
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            let windows = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows)
            guard let window = windows.first(where: \.isKeyWindow),
                  let fold = window.reservedRegions(kind: .division, options: .includeInactive).first
            else { return false }
            return fold.frame.height > fold.frame.width
        }
        #endif
        return false
    }

    /// Reads the screen from a view that fills the safe area: its proxy is the safe area, and its insets reach the
    /// screen's edges (measured on the Duo simulator: closed, 382 x 644 with insets 0, 0, 34, 84). Regions come in
    /// the proxy's points, which start at the safe area's corner.
    static func read(_ proxy: GeometryProxy) -> MomentsDuoScreen {
        let insets = proxy.safeAreaInsets
        let size = CGSize(
            width: proxy.size.width + insets.leading + insets.trailing,
            height: proxy.size.height + insets.top + insets.bottom
        )
        var screen = MomentsDuoScreen(size: size, insets: insets)
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            let onScreen = { (frame: CGRect) in frame.offsetBy(dx: insets.leading, dy: insets.top) }
            screen.occlusions = proxy.reservedRegions(kind: .occlusion).map { onScreen($0.frame) }
            if let fold = proxy.reservedRegions(kind: .division, options: .includeInactive).first {
                // Open: a fold from top to bottom is the screen held sideways; across it, held upright.
                screen.fold = onScreen(fold.frame)
                if fold.frame.height > fold.frame.width {
                    screen.pose = .wide(book: fold.isActive)
                } else {
                    screen.pose = fold.isActive ? .table : .upright
                }
            } else if proxy.safeAreaInsets.trailing >= 60, proxy.safeAreaInsets.leading < 20 {
                // Closed: the side strip (84 pt) is the trailing safe area; a phone held upright has none.
                screen.pose = .closed
            }
        }
        #endif
        return screen
    }
}

extension View {
    /// Keeps `screen` up to date with how the Duo is held. Put it on a view that fills the safe area (a tab's
    /// screen, a full-screen cover). It reads a clear layer behind the view and never changes the view's size, so
    /// the layout it feeds can't loop.
    func readsMomentsDuoScreen(_ screen: Binding<MomentsDuoScreen>) -> some View {
        background {
            Color.clear
                .onGeometryChange(for: MomentsDuoScreen.self) { proxy in
                    MomentsDuoScreen.read(proxy)
                } action: { screen.wrappedValue = $0 }
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
    }
}

private struct MomentsDuoScreenKey: EnvironmentKey {
    static let defaultValue = MomentsDuoScreen()
}

extension EnvironmentValues {
    /// How the iPhone Duo is held, as the Moments tab reads it: a cover opened over it uses it until it reads its own.
    var momentsDuoScreen: MomentsDuoScreen {
        get { self[MomentsDuoScreenKey.self] }
        set { self[MomentsDuoScreenKey.self] = newValue }
    }
}
