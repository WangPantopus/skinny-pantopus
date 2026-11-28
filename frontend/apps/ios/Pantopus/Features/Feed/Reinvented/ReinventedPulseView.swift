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
    @State private var showsFilters = false
    @State private var lensOpen = false
    private let filterStore = ReinventedPulseFilterStore.shared
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
        .task {
            // The kept filters and When first (PHASE-5 B: remembered per person on this phone), so the first reads carry them.
            filterStore.read()
            map.pick(time: filterStore.time)
            map.apply(filters: filterStore.params(time: map.time, forList: false))
            model.prime(filters: filterStore.params(time: map.time, forList: true))
            await model.refresh()
        }
        .task { await strip.read() }
        .onChange(of: filterStore.filters) { _, _ in applyFilters() }
        .onChange(of: map.time) { _, _ in applyFilters() }
        .sheet(isPresented: $showsFilters) {
            ReinventedPulseFiltersSheet(map: map) { showsFilters = false }
        }
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

    /// The top line (PHASE-6 A1): one row, 44 pt high: the side menu, the scope pill, Map | Atlas, the search lens and
    /// the chat button. Pulled down (here, the map's top), it drops the Filters sheet.
    private func topLine(sideBySide: Bool) -> some View {
        // The round buttons are 36 drawn in 44 to the finger, so 2 pt between them still leaves 10 between the circles:
        // the room goes to the scope pill (it read "Aroun…" on a 402 pt iPhone).
        HStack(spacing: 2) {
            NavigationMenuButton(accessibilityIdentifier: "reinventedPulse.menu", floating: false)
                .background(Circle().fill(.regularMaterial).frame(width: 36, height: 36))
            scopePill
            viewSwitch(sideBySide: sideBySide)
            lensButton
            MessagesButton(accessibilityIdentifier: "reinventedPulse.chat", floating: false)
                .background(Circle().fill(.regularMaterial).frame(width: 36, height: 36))
        }
        .frame(height: 44)
        .padding(.horizontal, Spacing.s3)
        .contentShape(Rectangle())
        .gesture(pullDown)
    }

    /// A pull down from the top line drops the Filters sheet (PHASE-6 A3, the gesture the founder asked for).
    private var pullDown: some Gesture {
        DragGesture(minimumDistance: 12)
            .onEnded { value in
                guard filtering, value.translation.height > 36,
                      value.translation.height > abs(value.translation.width) else { return }
                showsFilters = true
            }
    }

    /// Filters and When apply to Pulse's own list and map, not to My Atlas or Explore.
    private var filtering: Bool {
        !inAtlas && model.reach != "explore"
    }

    /// The town's name (or Close circle, or Explore); it opens the reach dial.
    private var scopePill: some View {
        Button { showsDial = true } label: {
            HStack(spacing: 5) {
                Icon(scopeIcon, size: 14, strokeWidth: 2.2, color: Theme.Color.primaryTint)
                Text(scopeTitle)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 10)
            .frame(height: 36)
            .background(Capsule().fill(.regularMaterial))
            .frame(minHeight: 44)
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

    /// Map | Atlas, small, in the top line (PHASE-6 A1: the List button is gone, the sheet is the list).
    private func viewSwitch(sideBySide: Bool) -> some View {
        HStack(spacing: 2) {
            switchButton("Map", on: !inAtlas) { pick(.peek, sideBySide: sideBySide) }
            switchButton("Atlas", on: inAtlas) { show(atlas: true, at: sideBySide ? .half : .full) }
        }
        .padding(2)
        .background(Capsule().fill(.regularMaterial))
        .fixedSize()
    }

    private func switchButton(_ title: String, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(on ? Color.white : Theme.Color.appText)
                .padding(.horizontal, 8)
                .frame(height: 32)
                .background(Capsule().fill(on ? Theme.Color.primarySolid : Color.clear))
                .frame(minHeight: 44)
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("reinventedPulse.view.\(title.lowercased())")
    }

    /// The search lens: one field for both jobs (Ask the map, and search).
    private var lensButton: some View {
        Button {
            withAnimation(.snappy(duration: 0.2)) { lensOpen = true }
        } label: {
            Icon(.search, size: 18, strokeWidth: 2.2, color: Theme.Color.appText)
                .frame(width: 36, height: 36)
                .background(Circle().fill(.regularMaterial))
                .frame(width: 44, height: 44)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Ask the map or search")
        .accessibilityIdentifier("reinventedPulse.lens")
    }

    /// Under the top line: what is filtered, and what the map lit for its question; nothing when neither.
    @ViewBuilder private var pills: some View {
        let count = filterStore.count(time: map.time)
        if filtering, count > 0 {
            ReinventedFilterPill(words: filterStore.words(time: map.time)) {
                showsFilters = true
            } onClear: {
                clearFilters()
            }
        }
        if let asked = askedLine {
            ReinventedFilterPill(words: asked) {
                withAnimation(.snappy(duration: 0.2)) { lensOpen = true }
            } onClear: {
                ReinventedMapAsk.shared.clear()
            }
        }
    }

    /// How many pills show under the top line.
    private var pillCount: Int {
        (filtering && filterStore.count(time: map.time) > 0 ? 1 : 0) + (askedLine == nil ? 0 : 1)
    }

    /// "3 lit for "cafe"", that nothing here matched, or why it couldn't ask.
    private var askedLine: String? {
        let ask = ReinventedMapAsk.shared
        if let error = ask.error { return error }
        guard let lit = ask.lit else { return nil }
        let shown = map.items.filter { lit.pins[$0.id] != nil }.count
        guard shown > 0 else { return "Nothing here for \u{201C}\(lit.q)\u{201D}" }
        return "\(shown) lit for \u{201C}\(lit.q)\u{201D}" + (lit.more ? ", and more" : "")
    }

    /// The filters on (or the When moved): the list and the map read again with them.
    private func applyFilters() {
        map.apply(filters: filterStore.params(time: map.time, forList: false))
        Task { await model.apply(filters: filterStore.params(time: map.time, forList: true)) }
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

    /// Under the top line and its pills: where the sheet's top stops at full.
    private var topHeight: CGFloat {
        4 + 44 + 8 + CGFloat(pillCount) * 38
    }

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
    /// A phone, or a screen too narrow for both: the rail on the map, the list's sheet over it, the top line on top.
    @ViewBuilder
    private func overMap(in geo: GeometryProxy) -> some View {
        rail
            .padding(.top, topHeight + Spacing.s3 - 8)
            .padding(.trailing, Spacing.s2)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        ReinventedPulseSheet(
            rest: $height,
            height: geo.size.height,
            fullTop: topHeight,
            line: sheetLine,
            content: panelContent
        ) { small in
            addButton(small: small)
        }
        header(sideBySide: false)
            .background(height == .full ? Theme.Color.appBg : Color.clear)
    }

    /// An iPad or the open iPhone Duo held sideways (PHASE-1 §2.2): the list and the map side by side.
    private var besideMap: some View {
        ReinventedPulseSideBySide(
            height: height,
            map: map,
            header: header(sideBySide: true),
            content: panelContent,
            add: addButton,
            rail: rail,
            onOpen: open
        )
    }

    /// The rail of round buttons down the right edge (PHASE-6 A2).
    private var rail: some View {
        ReinventedPulseRail(map: map, filtering: filtering) { showsFilters = true }
    }

    /// The top line (or the lens, opened) and, under it, the pills.
    private func header(sideBySide: Bool) -> some View {
        VStack(spacing: 6) {
            if lensOpen {
                ReinventedLensField(map: map) {
                    withAnimation(.snappy(duration: 0.2)) { lensOpen = false }
                } onSearchAtlas: { words in
                    ReinventedAtlasSearchPending.words = words
                    lensOpen = false
                    show(atlas: true, at: sideBySide ? .half : .full)
                }
                .padding(.horizontal, Spacing.s3)
                .frame(minHeight: 44, alignment: .top)
            } else {
                topLine(sideBySide: sideBySide)
            }
            pills
        }
        .padding(.top, 4)
        .padding(.bottom, 8)
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
                onOpenRun: playRun,
                onClearFilters: clearFilters
            )
        }
    }

    private func clearFilters() {
        filterStore.clear()
        map.pick(time: "live")
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
