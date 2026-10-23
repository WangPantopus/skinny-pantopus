//
//  PlansMapSheet.swift
//  Pantopus
//
//  The Plans sheet over the map (board P3): the grab handle, what the sheet
//  holds (boards F1 to F5) and the Host button above it. It rests at three
//  stops and follows the finger between them, then springs to the stop the
//  drag aims at, starting at the finger's speed. It is laid out once, where
//  it stands at full against the bottom of the screen, and slides down by an
//  offset; the drag lives here and in `PlansSheetDrag`, so a drag frame moves
//  one offset and redraws neither the map nor the list. Below full a drag
//  anywhere on the sheet moves it; at full its list scrolls (under the glass
//  tab bar, as before), and a pull down at the list's top moves the sheet.
//

import SwiftUI

/// The stops (board P3, retuned on 2026-10-23 so the map leads): peek shows
/// the sheet's first lines (the title and the first plans, or the suggestion
/// card), half about half the screen or the whole card or message when it
/// fits, and full stops just under the floating chrome, which stays on screen.
struct PlansSheetLayout: Equatable {
    /// From the top of the safe area to the bottom of the screen.
    var height: CGFloat = 0
    /// The tab bar and the home indicator, which the sheet runs under.
    var bottomInset: CGFloat = 0
    /// The bottom of the area pill and the chips.
    var chromeBottom: CGFloat = 0
    /// Where the first lines end, from the top of the content (0 until measured).
    var peekEnd: CGFloat = 0
    /// The whole card or message (F3, F4, F5), from the top of the content; 0 for the list.
    var fit: CGFloat = 0
    /// The lowest stop the content rests at: "See plans near you" (F5) never sits below half.
    var lowest: PlansSheetStop = .peek

    /// The grab handle and its spacing, above the content.
    static let handle: CGFloat = 25
    /// Faster than this (points a second) a release moves at least one stop its way.
    static let flick: CGFloat = 300

    /// From the top of the safe area to the top of the tab bar: what the sheet can show.
    private var room: CGFloat {
        max(height - bottomInset, 1)
    }

    var fullTop: CGFloat {
        chromeBottom > 0 ? chromeBottom + Spacing.s2 : room * 0.08
    }

    var halfTop: CGFloat {
        let shown = fit > 0 ? min(fit + Self.handle, room * 0.62) : room * 0.5
        return max(room - shown, fullTop)
    }

    var peekTop: CGFloat {
        guard lowest == .peek else { return halfTop }
        let lines = peekEnd > 0 ? peekEnd + Self.handle + Spacing.s3 : room * 0.28
        return max(room - min(max(lines, 112), room * 0.45), halfTop)
    }

    /// The sheet's own height: from its top at full to the bottom of the screen.
    var sheetHeight: CGFloat {
        max(height - fullTop, 0)
    }

    func top(_ stop: PlansSheetStop) -> CGFloat {
        switch stop {
        case .peek: peekTop
        case .half: halfTop
        case .full: fullTop
        }
    }

    /// The top under a finger, giving less and less past the highest and lowest stops.
    func held(_ position: CGFloat) -> CGFloat {
        if position < fullTop { return fullTop - Self.resist(fullTop - position) }
        if position > peekTop { return peekTop + Self.resist(position - peekTop) }
        return position
    }

    /// Where a release at `position`, moving at `velocity` (points a second,
    /// down positive), comes to rest: the stop nearest where the drag aims,
    /// and after a flick at least the next stop its way.
    func stop(releasedAt position: CGFloat, velocity: CGFloat) -> PlansSheetStop {
        let stops = PlansSheetStop.allCases.map { (stop: $0, top: top($0)) }
        let aimed = position + velocity * 0.18
        var target = stops.min { abs($0.top - aimed) < abs($1.top - aimed) }?.stop ?? lowest
        if velocity < -Self.flick, top(target) > position - 1,
           let above = stops.filter({ $0.top < position - 1 }).max(by: { $0.top < $1.top }) {
            target = above.stop
        } else if velocity > Self.flick, top(target) < position + 1,
                  let below = stops.filter({ $0.top > position + 1 }).min(by: { $0.top < $1.top }) {
            target = below.stop
        }
        return target
    }

    /// UIScrollView's rubber band: the farther past a stop, the less it gives.
    private static func resist(_ distance: CGFloat) -> CGFloat {
        let limit: CGFloat = 120
        return limit * (1 - 1 / (distance * 0.55 / limit + 1))
    }
}

/// What the sheet holds, for its measures: a card or message on its way out
/// can't move the stops of what replaced it.
enum PlansSheetPart: Hashable {
    case list, empty, location, status
    case card(String)
}

/// The finger on the Plans sheet: where it holds the sheet, and the hand-off
/// between the sheet and its list at the full stop.
@Observable
@MainActor
final class PlansSheetDrag {
    /// The sheet's top while a finger holds it; nil while it rests at its stop.
    private(set) var heldTop: CGFloat?
    /// The list holds still while the sheet takes over a pull that began in it.
    private(set) var locksList = false
    /// Where each content's first lines end, measured: the lowest stop shows down to here.
    private(set) var peekEnds: [PlansSheetPart: CGFloat] = [:]
    /// Each card's or message's whole height, measured: the middle stop fits it.
    private(set) var fits: [PlansSheetPart: CGFloat] = [:]

    /// The stops as the screen last laid them out.
    @ObservationIgnored var layout = PlansSheetLayout()
    /// How far the list is pulled past its top (its bounce); 0 when it isn't.
    @ObservationIgnored var listPull: CGFloat = 0
    @ObservationIgnored var reduceMotion = false
    @ObservationIgnored private var startTop: CGFloat = 0
    @ObservationIgnored private var startTranslation: CGFloat = 0
    @ObservationIgnored private var lastListTranslation: CGFloat = 0
    @ObservationIgnored private var hasMeasured = false
    private let viewModel: PlansMapViewModel

    init(viewModel: PlansMapViewModel) {
        self.viewModel = viewModel
    }

    var stop: PlansSheetStop {
        viewModel.shownStop
    }

    /// The list scrolls only at the full stop, and not while the sheet has the finger.
    var listScrolls: Bool {
        stop == .full && !locksList
    }

    /// A drag on the handle, a header, or anywhere on the sheet below full.
    func moved(_ value: DragGesture.Value) {
        if heldTop == nil { start(at: value.translation.height) }
        heldTop = layout.held(startTop + value.translation.height - startTranslation)
    }

    /// A drag in the list at full. It scrolls the list until the list is
    /// pulled past its top; from there it moves the sheet, and the list
    /// holds still (no bounce under the finger).
    func listMoved(_ value: DragGesture.Value) {
        let translation = value.translation.height
        defer { lastListTranslation = translation }
        if heldTop == nil {
            guard listPull > 0.5, translation >= lastListTranslation else { return }
            locksList = true
            start(at: translation)
        }
        heldTop = layout.held(startTop + translation - startTranslation)
    }

    func ended(_ value: DragGesture.Value) {
        settle(velocity: value.velocity.height)
    }

    /// The system cancelled a drag (no end comes): the sheet still goes to a stop.
    func settleIfHeld() {
        settle(velocity: 0)
    }

    func measured(_ value: CGFloat, peek: Bool, part: PlansSheetPart) {
        let old = (peek ? peekEnds[part] : fits[part]) ?? 0
        guard abs(old - value) > 0.5 else { return }
        // The first measure places the sheet; later ones (a longer card, the list loading) glide.
        let glides = hasMeasured && heldTop == nil && !reduceMotion
        hasMeasured = true
        withAnimation(glides ? .smooth(duration: 0.3) : nil) {
            if peek { peekEnds[part] = value } else { fits[part] = value }
        }
    }

    private func start(at translation: CGFloat) {
        startTop = layout.top(stop)
        startTranslation = translation
    }

    private func settle(velocity: CGFloat) {
        lastListTranslation = 0
        guard let held = heldTop else { return }
        let target = layout.stop(releasedAt: held, velocity: velocity)
        withAnimation(spring(velocity: velocity, distance: layout.top(target) - held)) {
            viewModel.sheetStop = target
            heldTop = nil
        }
        locksList = false
    }

    /// Board P3's spring (about 0.35 s), starting at the finger's speed; a short ease under Reduce Motion.
    private func spring(velocity: CGFloat, distance: CGFloat) -> Animation {
        if reduceMotion { return .easeInOut(duration: 0.15) }
        let relative = abs(distance) > 1 ? min(max(velocity / distance, -10), 10) : 0
        return .interpolatingSpring(Spring(response: 0.35, dampingRatio: 0.86), initialVelocity: Double(relative))
    }
}

/// The sheet: laid out where it stands at full, and moved down to its stop.
struct PlansMapSheet: View {
    let viewModel: PlansMapViewModel
    let drag: PlansSheetDrag
    /// The screen's part of the layout: its height, the tab bar and the chrome.
    let screen: PlansSheetLayout
    let actions: PlansMapActions
    let onStop: (PlansSheetStop) -> Void

    var body: some View {
        let layout = sheetLayout
        let stop = viewModel.shownStop
        PlansSheetPosition(drag: drag, rest: layout.top(stop), fullTop: layout.fullTop) {
            sheet(layout: layout, stop: stop)
        }
        // Against the bottom of the screen, as the sheet always stood, so its list keeps the tab bar's inset.
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("plansSheet")
        .onChange(of: layout, initial: true) { _, layout in drag.layout = layout }
    }

    private func sheet(layout: PlansSheetLayout, stop: PlansSheetStop) -> some View {
        VStack(spacing: 0) {
            handle
            PlansSheetContent(viewModel: viewModel, actions: actions, onStop: onStop)
                .frame(maxHeight: .infinity, alignment: .top)
                .coordinateSpace(.named(PlansSheetSpace.content))
        }
        .padding(.bottom, layout.bottomInset)
        .frame(maxWidth: .infinity)
        // Content taller than the sheet (the largest text) runs off its bottom, never over the map.
        .frame(height: layout.sheetHeight, alignment: .top)
        .clipped()
        .background(alignment: .top) {
            // Taller than the sheet, so a pull past full never shows the map under it.
            UnevenRoundedRectangle(topLeadingRadius: Radii.xl3, topTrailingRadius: Radii.xl3, style: .continuous)
                .fill(Theme.Color.appSurface)
                .frame(height: layout.sheetHeight + 160)
                .shadow(color: .black.opacity(0.12), radius: 12, x: 0, y: -6)
        }
        // Below full a drag anywhere moves the sheet (ahead of its buttons); at full the
        // handle, the headers and the list's top do.
        .modifier(PlansSheetGesture(drag: drag, mask: stop == .full ? .subviews : .all))
        .overlay(alignment: .topTrailing) { hostButton }
        .environment(drag)
    }

    private var sheetLayout: PlansSheetLayout {
        var layout = screen
        let shown = part
        layout.peekEnd = drag.peekEnds[shown] ?? 0
        // A pin's card (F3), "Nothing planned yet" (F4) and "See plans near you" (F5)
        // sit at their own height in the middle; the list takes about half.
        switch shown {
        case .card, .empty, .location: layout.fit = drag.fits[shown] ?? 0
        case .list, .status: layout.fit = 0
        }
        layout.lowest = shown == .location ? .half : .peek
        return layout
    }

    /// What the sheet holds now, as `PlansSheetContent` picks it.
    private var part: PlansSheetPart {
        switch viewModel.phase {
        case .locating: return .status
        case .needsLocation: return .location
        case .ready: break
        }
        if let id = viewModel.selectedId { return .card(id) }
        if !viewModel.listLoaded { return .status }
        return viewModel.isEmpty ? .empty : .list
    }

    private var handle: some View {
        Capsule()
            .fill(Theme.Color.appBorderStrong)
            .frame(width: 36, height: 5)
            .padding(.top, Spacing.s2)
            .padding(.bottom, Spacing.s3)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
            .onTapGesture { onStop(viewModel.sheetStop == .full ? .peek : .full) }
            // The grab handle moves the sheet at every stop, the list's scrolling at full included.
            .modifier(PlansSheetGesture(drag: drag))
            .accessibilityElement()
            .accessibilityLabel("Plans list")
            .accessibilityValue(stopName)
            .accessibilityAddTraits(.isButton)
            .accessibilityAction(named: "Show more") { onStop(.full) }
            .accessibilityAction(named: "Show less") { onStop(.peek) }
    }

    /// Board F1 "Host", floating above the sheet at its lowest stop; it rides along with a drag.
    @ViewBuilder private var hostButton: some View {
        if viewModel.phase == .ready, viewModel.selectedId == nil, viewModel.sheetStop == .peek, !viewModel.isEmpty {
            PlansHostButton { actions.host(nil) }
                .padding(.trailing, Spacing.s4)
                .padding(.bottom, 18)
                // No height of its own: it stands on the sheet's top edge, over the map.
                .frame(height: 0, alignment: .bottom)
                .transition(.opacity)
        }
    }

    private var stopName: String {
        switch viewModel.shownStop {
        case .peek: "Collapsed"
        case .half: "Half open"
        case .full: "Open"
        }
    }
}

/// The one view a drag frame redraws: the sheet's offset down from where it stands at full.
/// A view of its own (not a modifier, whose reads count as the sheet's), holding the sheet
/// as built, so a frame of the drag evaluates nothing else.
private struct PlansSheetPosition<Content: View>: View {
    let drag: PlansSheetDrag
    let rest: CGFloat
    let fullTop: CGFloat
    @ViewBuilder let content: Content

    var body: some View {
        content.offset(y: (drag.heldTop ?? rest) - fullTop)
    }
}

/// The drag that moves the sheet, on one part of it.
private struct PlansSheetGesture: ViewModifier {
    let drag: PlansSheetDrag
    /// A list's drag runs beside the list's own scrolling; any other one goes ahead of the buttons under it.
    var inList = false
    var mask: GestureMask = .all
    /// Set while the finger is down: a drag the system cancels never ends, so the sheet settles then.
    @GestureState private var isActive = false

    func body(content: Content) -> some View {
        Group {
            if inList {
                content.simultaneousGesture(gesture, including: mask)
            } else {
                content.highPriorityGesture(gesture, including: mask)
            }
        }
        .onChange(of: isActive) { _, isActive in
            if !isActive { Task { drag.settleIfHeld() } }
        }
    }

    private var gesture: some Gesture {
        // In the window's coordinates: the sheet moves under the finger, and a translation in
        // its own coordinates would chase itself.
        DragGesture(minimumDistance: inList ? 8 : 10, coordinateSpace: .global)
            .updating($isActive) { _, isActive, _ in isActive = true }
            .onChanged { value in
                if inList {
                    drag.listMoved(value)
                } else {
                    drag.moved(value)
                }
            }
            .onEnded { drag.ended($0) }
    }
}

/// A scroll view inside the Plans sheet. It scrolls at the full stop only; a
/// pull past its top moves the sheet instead of bouncing the list; and it is
/// back at its top whenever the sheet leaves full.
struct PlansSheetScroll<Content: View>: View {
    @Environment(PlansSheetDrag.self) private var drag: PlansSheetDrag?
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        let isFull = drag?.stop == .full
        ScrollViewReader { proxy in
            ScrollView {
                content
                    // The lines that set the stops measure from the top of the content, scrolled or not.
                    .coordinateSpace(.named(PlansSheetSpace.content))
                    .id(PlansSheetSpace.scrollTop)
                    .onGeometryChange(for: CGFloat.self) { geometry in
                        max(geometry.frame(in: .named(PlansSheetSpace.scroll)).minY, 0)
                    } action: { drag?.listPull = $0 }
            }
            .coordinateSpace(.named(PlansSheetSpace.scroll))
            .scrollIndicators(.hidden)
            .scrollDisabled(!(drag?.listScrolls ?? true))
            .modifier(PlansSheetListGesture(drag: drag, isFull: isFull))
            .onChange(of: isFull) { _, isFull in
                if !isFull { proxy.scrollTo(PlansSheetSpace.scrollTop, anchor: .top) }
            }
        }
    }
}

/// The sheet's coordinate spaces: its content, for the lines that set its stops, and its list.
private enum PlansSheetSpace {
    static let content = "plansSheetContent"
    static let scroll = "plansSheetScroll"
    static let scrollTop = "plansSheetScrollTop"
}

private struct PlansSheetListGesture: ViewModifier {
    let drag: PlansSheetDrag?
    let isFull: Bool

    func body(content: Content) -> some View {
        if let drag {
            content.modifier(PlansSheetGesture(drag: drag, inList: true, mask: isFull ? .all : .subviews))
        } else {
            content
        }
    }
}

extension View {
    /// A part of the sheet that never scrolls (a header, a loading state): a
    /// drag on it moves the sheet at every stop, ahead of its buttons.
    func plansSheetDragArea() -> some View {
        modifier(PlansSheetDragArea())
    }

    /// The sheet's lowest stop shows `part` down to the bottom of this view (when `isOn`).
    func plansSheetPeekEnd(_ part: PlansSheetPart, isOn: Bool = true) -> some View {
        modifier(PlansSheetMeasure(peek: true, part: part, isOn: isOn))
    }

    /// The middle stop fits this whole card or message (`part`) when there's room.
    func plansSheetFit(_ part: PlansSheetPart) -> some View {
        modifier(PlansSheetMeasure(peek: false, part: part))
    }
}

private struct PlansSheetDragArea: ViewModifier {
    @Environment(PlansSheetDrag.self) private var drag: PlansSheetDrag?

    func body(content: Content) -> some View {
        if let drag {
            content
                .contentShape(Rectangle())
                .modifier(PlansSheetGesture(drag: drag))
        } else {
            content
        }
    }
}

private struct PlansSheetMeasure: ViewModifier {
    let peek: Bool
    let part: PlansSheetPart
    var isOn = true
    @Environment(PlansSheetDrag.self) private var drag: PlansSheetDrag?

    func body(content: Content) -> some View {
        content.onGeometryChange(for: CGFloat.self) { [peek] geometry in
            peek ? geometry.frame(in: .named(PlansSheetSpace.content)).maxY : geometry.size.height
        } action: { value in
            if isOn { drag?.measured(value, peek: peek, part: part) }
        }
    }
}
