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
//  it was. So is watching itself (`MomentsWatchSession`): on the iPhone Duo a
//  fold can build the viewer again, and it picks up where it was.
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

/// Hand-off into the Moments tab from outside it: the "added a Moment" push and its link
/// (`/app/moments/<id>`). `MomentsTabRoot` plays it.
@Observable
@MainActor
final class MomentsNavigator {
    static let shared = MomentsNavigator()

    /// A Moment to play once the Moments tab shows.
    var pending: String?

    private init() {}
}

/// Posting, from + or "Add a Moment". What's being written is held here, above the composer's cover: on the
/// iPhone Duo a fold can build the composer again, and it picks up where it was.
struct MomentsComposeRequest: Identifiable {
    let id = UUID()
    let model: MomentsComposerModel
}

public struct MomentsTabRoot: View {
    @State private var flags = MomentsFlags.shared
    @State private var map = MomentsMapViewModel()
    @State private var watching: MomentsWatchSession?
    @State private var composing: MomentsComposeRequest?
    /// How the iPhone Duo is held (`.phone` on phones), for the screens opened over the map.
    @State private var duo = MomentsDuoScreen()
    @State private var showsAreaPicker = false
    @State private var navigator = MomentsNavigator.shared
    /// The phone's light or dark, for the sheets over the always-dark viewer.
    @Environment(\.colorScheme) private var colorScheme

    public init() {}

    public var body: some View {
        NavigationStack {
            // Open sideways, the iPhone Duo shows watching as a card beside the map (board O2).
            MomentsMapView(
                viewModel: map,
                actions: actions,
                watching: duo.pose.isWide ? watching : nil,
                viewerHooks: viewerHooks
            )
            .toolbar(.hidden, for: .navigationBar)
        }
        .sheet(isPresented: $showsAreaPicker) {
            MomentsAreaPicker(viewModel: map) { showsAreaPicker = false }
                .presentationDetents([.medium])
                .presentationBackground(Theme.Color.appSurface)
        }
        // Everywhere else it's full screen. A fold that moves it into the card takes the cover down without ending
        // it: only the person's close ends watching.
        .fullScreenCover(item: Binding(get: { duo.pose.isWide ? nil : watching }, set: { _ in })) { session in
            MomentsViewer(
                session: session,
                systemScheme: colorScheme,
                onShowPlace: { ring in map.showPlace(latitude: ring.latitude, longitude: ring.longitude) },
                onHideAuthor: viewerHooks.onHideAuthor,
                onShowAuthor: viewerHooks.onShowAuthor,
                onClose: viewerHooks.onClose
            )
        }
        .fullScreenCover(item: $composing) { request in
            MomentsComposer(model: request.model) { composing = nil }
        }
        .onChange(of: flags.moments) { _, isOn in
            // Moments switched off: nothing of Moments is left open (the bar drops this tab).
            if !isOn {
                endWatching()
                composing?.model.abandon()
                composing = nil
                showsAreaPicker = false
                navigator.pending = nil
            }
        }
        .onChange(of: navigator.pending, initial: true) { _, _ in playLinked() }
        // A link that came while a Moment was being written waits for the composer to close.
        .onChange(of: composing == nil) { _, _ in playLinked() }
        // A fold or a turn switches layouts at once (the card and the cover trade places without sliding).
        .readsMomentsDuoScreen(Binding(get: { duo }, set: { screen in
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) { duo = screen }
        }))
        // The screens opened over the map know how the Duo is held from their first frame.
        .environment(\.momentsDuoScreen, duo)
    }

    /// What watching does to the map, in the cover or the card: hides a muted or blocked person, and on close reads
    /// the map again.
    private var viewerHooks: MomentsViewerHooks {
        MomentsViewerHooks(
            onHideAuthor: { map.hide(authorId: $0) },
            onShowAuthor: { map.unhide(authorId: $0) },
            onClose: {
                endWatching()
                Task { await map.load() }
                // A Moment opened from a push while another tab was up: what was watched is no longer new.
                Task { await MomentsTabDot.shared.reread() }
            }
        )
    }

    /// Watching starts: whatever was playing before stops.
    private func watch(_ request: MomentsWatchRequest) {
        watching?.end()
        watching = MomentsWatchSession(request: request) { map.markWatched($0) }
    }

    /// The person closed it (or Moments went away): it stops. A screen going away never stops it.
    private func endWatching() {
        watching?.end()
        watching = nil
    }

    /// A Moment named by a link (the "added a Moment" push): the viewer opens on that one, as from a chat
    /// quote. Ended, or not yours to see: the map, with a line saying so.
    private func playLinked() {
        guard flags.moments, composing == nil, let id = navigator.pending else { return }
        navigator.pending = nil
        showsAreaPicker = false
        Task {
            do {
                let moment = try await MomentsAPI.send(MomentsEndpoints.moment(id: id), as: MomentEnvelope.self).moment
                var me: String?
                if case let .signedIn(user) = AuthManager.shared.state { me = user.id }
                let ring = MomentRingDTO(moment: moment, mine: moment.author.id == me)
                watch(MomentsWatchRequest(rings: [ring], start: 0, newOnly: false))
            } catch {
                let failure = error as? MomentsFailure
                // The map's short note (the pill that says "Your Moment is live"), without its check mark.
                MomentsUploader.shared.plainNote = failure == .ended || failure == .notFound
                    ? "This Moment has ended."
                    : failure?.message ?? "Couldn't open that Moment."
            }
        }
    }

    private var actions: MomentsMapActions {
        MomentsMapActions(
            watch: { rings, start, newOnly in
                guard !rings.isEmpty else { return }
                watch(MomentsWatchRequest(rings: rings, start: start, newOnly: newOnly))
            },
            compose: { composing = MomentsComposeRequest(model: MomentsComposerModel()) },
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
