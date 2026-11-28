//
//  ReinventedPulseView.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 1 (PHASE-1 §2 pieces 2 to 5; board B1): Pulse as it opens while `pulse_reinvented` is on.
//  The top row (the side menu, the scope pill with the town's name, the chat button), the Map | Atlas switch, the chips
//  the place has, and the list over the map. Phase 6 (PHASE-6 §2 A3): on a phone the list is a sheet with three rests
//  (peek, half: how it opens, full), moved only by its header (`ReinventedPulseSheet`); the List button is gone, the
//  sheet is the list. A Moment that fades is borderless and full
//  width with its time left; a post that stays is today's Pulse card with a status line. Bands mark the distance; the
//  list ends "Caught up around you. Keep exploring?". Built beside today's feed (`FeedView`), which shows whenever the
//  switch is off.
//

import MapKit
import SwiftUI

struct ReinventedPulseView: View {
    /// The sheet's rests on a phone (PHASE-6 A3). Side by side: half shows both, full the list alone, peek the map.
    enum Height {
        case peek, half, full

        static let phone: [Height] = [.peek, .half, .full]
    }

    let onOpenPost: (String) -> Void

    @State private var model = ReinventedPulseModel()
    @State private var map = ReinventedMapModel()
    @State private var strip = ReinventedStripModel()
    @State private var height: Height = .half
    @State private var showsDial = false
    /// My Atlas (CONTRACT 6e, `ReinventedAtlas`): the switch's third choice, and the kept Moment opened from it.
    @State private var atlas = ReinventedAtlasModel()
    @State private var inAtlas = false
    @State private var atlasItem: MomentDTO?
    /// "This Moment has ended." after a link to one that can't be played.
    @State private var linkNote: String?
    /// Regular width (an iPad, the iPhone Duo open) puts the list and the map side by side where they fit.
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        // Read in layout, so the first pass already picks over the map or beside it.
        GeometryReader { geo in
            let sideBySide = ReinventedPulseColumns.fits(width: geo.size.width, sizeClass: horizontalSizeClass)
            ZStack(alignment: .top) {
                ReinventedPulseMap(model: map, onOpen: open)
                    .ignoresSafeArea()
                    .padding(.leading, ReinventedPulseColumns.mapInset(height, sideBySide: sideBySide))
                if sideBySide {
                    besideMap
                } else {
                    overMap(in: geo)
                }
            }
        }
        // The tab keeps its pages to a reading column: where the map fits beside the list, Pulse takes the width.
        .readableColumnWidens(from: ReinventedPulseColumns.widensFrom(sizeClass: horizontalSizeClass))
        .task { await model.refresh() }
        .task { await strip.read() }
        .sheet(item: $atlasItem) { moment in
            ReinventedAtlasItem(moment: moment, model: atlas) { atlasItem = nil }
                .presentationDetents([.large])
                // A Moment deleted for good leaves the map too.
                .onDisappear { if inAtlas { map.reread() } }
        }
        // A Moment's link or notice (PHASE-1 §3): with every Moment in Pulse, it plays here.
        .onChange(of: MomentsNavigator.shared.pending, initial: true) { _, _ in playLinked() }
        .alert(linkNote ?? "", isPresented: Binding(get: { linkNote != nil }, set: { if !$0 { linkNote = nil } })) {
            Button("OK", role: .cancel) {}
        }
        // The Studio closed (`ReinventedStudioCover`, on the Pulse tab's root): what it posted may be in the list.
        .onChange(of: ReinventedStudioPresenter.shared.closings) { _, _ in
            Task { await model.refresh() }
        }
        .modifier(MomentRetakeListSheet())
        .modifier(MomentConvergenceListSheet())
        .modifier(MomentPinboardListSheet())
        .modifier(MomentMailItHost())
    }

    /// One camera (PHASE-1 §2.11): + opens the Studio. Its "+ Ask / Kind" comes with that piece.
    private var addButton: some View {
        addButton(small: false)
    }

    /// `small`: in the sheet's header at full (PHASE-6 A4), still 44 pt to the finger.
    private func addButton(small: Bool) -> some View {
        Button {
            ReinventedStudioPresenter.shared.composing = MomentsComposeRequest(model: MomentsComposerModel(), studio: true)
        } label: {
            Icon(.plus, size: small ? 18 : 26, strokeWidth: 2.6, color: .white)
                .frame(width: small ? 32 : 58, height: small ? 32 : 58)
                .background(Circle().fill(Theme.Color.primarySolid))
                .shadow(color: .black.opacity(small ? 0 : 0.25), radius: 6, y: 3)
                .frame(width: small ? 44 : 58, height: small ? 44 : 58)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add a Moment")
        .accessibilityIdentifier("reinventedPulse.add")
    }

    // MARK: - Top

    /// `floating`: round material buttons over the map; plain on the list's own background.
    private func topRow(floating: Bool) -> some View {
        HStack(spacing: Spacing.s2) {
            NavigationMenuButton(accessibilityIdentifier: "reinventedPulse.menu", floating: floating)
            scopePill
            MessagesButton(accessibilityIdentifier: "reinventedPulse.chat", floating: floating)
        }
        .padding(.horizontal, Spacing.s4)
    }

    /// The town's name (or Close circle, or Explore); it opens the reach dial.
    private var scopePill: some View {
        Button { showsDial = true } label: {
            HStack(spacing: Spacing.s2) {
                Icon(scopeIcon, size: 16, strokeWidth: 2.2, color: Theme.Color.primaryTint)
                Text(scopeTitle)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Icon(.chevronDown, size: 16, color: Theme.Color.appText)
            }
            .padding(.horizontal, Spacing.s4)
            .frame(height: 44)
            .background(Capsule().fill(Theme.Color.appSurface))
            .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Showing \(scopeTitle). Change what Pulse shows")
        .accessibilityIdentifier("reinventedPulse.scope")
        .sheet(isPresented: $showsDial) {
            ReinventedReachDial(reach: model.reach, miles: model.miles, circle: model.circle) { reach, miles, circle in
                Task { await model.pick(reach: reach, miles: miles, circle: circle) }
            }
        }
    }

    private var scopeIcon: PantopusIcon {
        switch model.reach {
        case "close": .users
        case "explore": .globe
        default: .mapPin
        }
    }

    private var scopeTitle: String {
        switch model.reach {
        case "close": model.circle?.name ?? "Close circle"
        case "explore": "Explore"
        default: model.placeLabel.map { "\($0) · \(model.miles) mi" } ?? "Around me"
        }
    }

    /// Map | Atlas (PHASE-6 A1: the List button is gone, the sheet is the list).
    private func viewSwitch(sideBySide: Bool) -> some View {
        HStack(spacing: 4) {
            switchButton("Map", icon: .map, on: !inAtlas) { pick(.peek, sideBySide: sideBySide) }
            switchButton("Atlas", icon: .bookmark, on: inAtlas) { show(atlas: true, at: sideBySide ? .half : .full) }
        }
        .padding(4)
        .background(Capsule().fill(Theme.Color.appSurface))
        .overlay(Capsule().stroke(Theme.Color.appBorder, lineWidth: 1))
        .padding(.horizontal, Spacing.s4)
    }

    private func switchButton(_ title: String, icon: PantopusIcon, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Icon(icon, size: 16, strokeWidth: 2.2, color: on ? .white : Theme.Color.appText)
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(on ? Color.white : Theme.Color.appText)
            }
            .frame(maxWidth: .infinity, minHeight: 40)
            .background(Capsule().fill(on ? Theme.Color.primarySolid : Color.clear))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("reinventedPulse.view.\(title.lowercased())")
    }

    private var chipsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s2) {
                ForEach(model.chips, id: \.self) { chip in
                    let on = model.chip == chip
                    Button { Task { await model.pick(chip: chip) } } label: {
                        Text(Self.chipTitle(chip))
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(on ? Color.white : Theme.Color.appText)
                            .padding(.horizontal, Spacing.s3)
                            .frame(height: 34)
                            .background(Capsule().fill(on ? Theme.Color.primarySolid : Theme.Color.appSurface))
                            .overlay(Capsule().stroke(on ? Color.clear : Theme.Color.appBorder, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
                    .accessibilityIdentifier("reinventedPulse.chip.\(chip)")
                }
            }
            .padding(.horizontal, Spacing.s4)
        }
    }

    static func chipTitle(_ chip: String) -> String {
        switch chip {
        case "all": "All"
        case "live": "Live"
        case "learn": "Learn"
        case "spots": "Spots"
        case "ask": "Ask"
        case "plans": "Plans"
        case "sports": "Sports"
        default: chip.capitalized
        }
    }

    // MARK: - The list over the map

    /// List, Map or Atlas: Atlas shows the person's kept Moments in the list's place and on the map.
    private func show(atlas: Bool, at next: Height) {
        inAtlas = atlas
        map.show(atlas: atlas)
        setHeight(next)
    }

    private func setHeight(_ next: Height) {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { height = next }
    }

    /// Under the top row, the switch and the chips: where the sheet's top stops at full.
    private static let header: CGFloat = 150

    /// The header's one line: how many things the map holds and when ("23 here · Live").
    private var sheetLine: String {
        let count = map.items.count
        if inAtlas { return count == 1 ? "1 kept here" : "\(count) kept here" }
        let when = ReinventedMapModel.times.first { $0.key == map.time }?.title ?? "Live"
        return "\(count) here · \(when)"
    }

    /// The viewer opens from the Pulse tab's root (`ReinventedStudioCover`), outside the tab's navigation stack.
    private func watch(_ ring: MomentRingDTO) {
        let request = MomentsWatchRequest(rings: [ring], start: 0, newOnly: false)
        ReinventedViewerPresenter.shared.watching = MomentsWatchSession(request: request) { _ in }
    }

    /// "Tonight in <town>" (8k): the film's Moments, oldest first, as one run in the viewer.
    private func playRun(_ rings: [MomentRingDTO]) {
        let request = MomentsWatchRequest(rings: rings, start: 0, newOnly: false)
        ReinventedViewerPresenter.shared.watching = MomentsWatchSession(request: request) { _ in }
    }

    private func open(_ moment: MomentDTO) {
        if RetakePrompt.shared.opens(moment) { return }
        if ConvergencePrompt.shared.opens(moment) { return }
        if PinboardPrompt.shared.opens(moment) { return }
        let ring = MomentRingDTO(moment: moment, mine: model.isMine(moment))
        watch(ring)
    }

    /// The Moment a link named: it plays at once; ended, or not one this person may see, a line says so.
    private func playLinked() {
        guard let id = MomentsNavigator.shared.pending else { return }
        MomentsNavigator.shared.pending = nil
        Task {
            do {
                let moment = try await MomentsAPI.send(MomentsEndpoints.moment(id: id), as: MomentEnvelope.self).moment
                open(moment)
            } catch {
                let failure = error as? MomentsFailure
                linkNote = failure == .ended || failure == .notFound ? "This Moment has ended." : failure?.message
                    ?? "Couldn't open that Moment."
            }
        }
    }

    /// A pin or a card on the map: a ring plays its Moments, a mark opens its post, a ticket its plan in Plans.
    private func open(_ item: ReinventedMapModel.Item) {
        switch item {
        case let .ring(ring):
            watch(ring)
        case let .mark(mark):
            onOpenPost(mark.post.id)
        case let .kept(kept):
            if inAtlas { atlasItem = kept.moment } else { open(kept.moment) }
        case let .ticket(ticket):
            DeepLinkRouter.shared.handle(path: "/plans/\(ticket.id)")
        }
    }
}

// MARK: - Over the map, or beside it

extension ReinventedPulseView {
    /// A phone, or a screen too narrow for both: the list rests over the map at three heights.
    @ViewBuilder
    private func overMap(in geo: GeometryProxy) -> some View {
        ReinventedPulseSheet(
            rest: $height,
            height: geo.size.height,
            fullTop: Self.header,
            line: sheetLine,
            content: panelContent
        ) { small in
            addButton(small: small)
        }
        header(sideBySide: false)
            .padding(.bottom, Spacing.s2)
            .background(height == .full ? Theme.Color.appBg : Color.clear)
    }

    /// An iPad or the open iPhone Duo held sideways (PHASE-1 §2.2): the list and the map side by side.
    private var besideMap: some View {
        ReinventedPulseSideBySide(
            height: height,
            map: map,
            showsTimeRow: !inAtlas && model.reach != "explore",
            header: header(sideBySide: true),
            content: panelContent,
            add: addButton,
            onOpen: open
        )
    }

    /// The top row, the switch and the chips, or the time row at the Map height. My Atlas has no time row and no chips.
    private func header(sideBySide: Bool) -> some View {
        VStack(spacing: Spacing.s2) {
            // Over the map the buttons float; side by side they stand on the list's background but at the Map height.
            topRow(floating: sideBySide ? height == .peek : height != .full)
            viewSwitch(sideBySide: sideBySide)
            if height == .peek, !inAtlas {
                ReinventedTimeRow(model: map)
                ReinventedAskBar(map: map) // phase 4: Ask the map
            } else if model.reach != "explore", !inAtlas {
                chipsRow
            }
        }
    }

    /// The list, or My Atlas in its place.
    @ViewBuilder private var panelContent: some View {
        if inAtlas {
            ReinventedAtlasView(model: atlas) { atlasItem = $0 }
        } else {
            ReinventedPulseList(
                model: model,
                strip: strip.strip,
                onOpenPost: onOpenPost,
                onOpenMoment: open,
                onOpenRing: { ring in open(.ring(ring)) },
                onRefreshStrip: { await strip.read() },
                onOpenRun: playRun
            )
        }
    }

    /// Map from the switch. On a phone the sheet lowers to its peek to show the map. Side by side, Map shows the map
    /// alone, and tapped again both.
    private func pick(_ next: Height, sideBySide: Bool) {
        if !sideBySide {
            show(atlas: false, at: next)
        } else if inAtlas {
            show(atlas: false, at: .half)
        } else {
            show(atlas: false, at: height == next ? .half : next)
        }
    }
}
