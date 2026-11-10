//
//  MomentsTabRoot.swift
//  Pantopus
//
//  The Moments tab (founder decision 2026-11-08, design canvas "Pantopus
//  Moments Screens"), between Pulse and Plans and present only while the
//  `moments` switch is on (`RootTabView` adds and removes it at runtime).
//  Its screen is the map; watching (V1–V5) and posting (P1–P4) open over it
//  full screen, and the map shows a Moment's progress after the Post sheet
//  closes (P5).
//
//  The map's rings, camera and the spot zoomed into are held here, above the
//  screen that shows them, so watching or posting comes back to the map as
//  it was.
//

import SwiftUI

/// Watching: these rings in this order, from one of them.
struct MomentsWatchRequest: Identifiable {
    let id = UUID()
    let rings: [MomentRingDTO]
    let start: Int
    /// Play all: only the Moments not watched yet.
    let newOnly: Bool
}

/// Posting, from + or "Add a Moment".
struct MomentsComposeRequest: Identifiable {
    let id = UUID()
}

public struct MomentsTabRoot: View {
    @State private var flags = MomentsFlags.shared
    @State private var map = MomentsMapViewModel()
    @State private var watching: MomentsWatchRequest?
    @State private var composing: MomentsComposeRequest?
    @State private var showsAreaPicker = false
    /// The phone's light or dark, for the sheets over the always-dark viewer.
    @Environment(\.colorScheme) private var colorScheme

    public init() {}

    public var body: some View {
        NavigationStack {
            MomentsMapView(viewModel: map, actions: actions)
                .toolbar(.hidden, for: .navigationBar)
        }
        .sheet(isPresented: $showsAreaPicker) {
            MomentsAreaPicker(viewModel: map) { showsAreaPicker = false }
                .presentationDetents([.medium])
                .presentationBackground(Theme.Color.appSurface)
        }
        .fullScreenCover(item: $watching) { request in
            MomentsViewer(
                request: request,
                systemScheme: colorScheme,
                onWatched: { map.markWatched($0) },
                onHideAuthor: { map.hide(authorId: $0) },
                onShowAuthor: { map.unhide(authorId: $0) },
                onClose: {
                    watching = nil
                    Task { await map.load() }
                }
            )
        }
        .fullScreenCover(item: $composing) { _ in
            MomentsComposer { composing = nil }
        }
        .onChange(of: flags.moments) { _, isOn in
            // Moments switched off: nothing of Moments is left open (the bar drops this tab).
            if !isOn {
                watching = nil
                composing = nil
                showsAreaPicker = false
            }
        }
    }

    private var actions: MomentsMapActions {
        MomentsMapActions(
            watch: { rings, start, newOnly in
                guard !rings.isEmpty else { return }
                watching = MomentsWatchRequest(rings: rings, start: start, newOnly: newOnly)
            },
            compose: { composing = MomentsComposeRequest() },
            areaPicker: { showsAreaPicker = true }
        )
    }
}

/// The area pill's sheet: where the map is.
struct MomentsAreaPicker: View {
    let viewModel: MomentsMapViewModel
    let onClose: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    row(title: "Near you", icon: .locationArrow, selected: viewModel.centerSource == .gps) {
                        Task { await viewModel.locate() }
                    }
                    .accessibilityIdentifier("moments.area.nearYou")
                    if viewModel.homeCenter != nil {
                        row(title: "Your home", icon: .home, selected: viewModel.centerSource == .home) {
                            Task { await viewModel.useHome() }
                        }
                        .accessibilityIdentifier("moments.area.home")
                    }
                } footer: {
                    Text("Your location only moves the map. Nobody sees it.")
                }
            }
            .navigationTitle("Area")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: onClose)
                }
            }
        }
    }

    private func row(title: String, icon: PantopusIcon, selected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            action()
            onClose()
        } label: {
            HStack(spacing: Spacing.s3) {
                Icon(icon, size: 18, color: Theme.Color.primaryTint)
                Text(title)
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.Color.appText)
                Spacer(minLength: 0)
                if selected { Icon(.check, size: 16, strokeWidth: 2.5, color: Theme.Color.primaryTint) }
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}
