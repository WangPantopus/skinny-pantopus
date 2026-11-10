//
//  CardTableScreen.swift
//  Pantopus
//
//  The whole phone becomes the table (launch key `card_table`). No tab row, top
//  bar or shelf: only the table, the mail, and a few controls. It reads the fold
//  of the iPhone Duo, loads the art and the picture before the envelope arrives,
//  and hands the finger to the model. Every gesture also has a button.
//

import SwiftUI
import UIKit

struct CardTableScreen: View {
    let model: CardTableModel
    let menuItems: [CardTableMenuItem]
    /// The person sent this card, so sharing talks about their own note.
    var isSender = false
    /// A card you sent, still sealed for them: the surprise is theirs, so it shares as the sealed envelope.
    var sharesSealed = false
    var closeLabel = "Back to the Mailbox"
    /// Off where there's nothing to share yet (Look it over).
    var canShare = true
    let onClose: () -> Void

    @State private var wordsHeight: CGFloat = 0
    @State private var actHeight: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @ScaledMetric(relativeTo: .title3) private var wordsSize: CGFloat = 18
    @ScaledMetric(relativeTo: .subheadline) private var primarySize: CGFloat = 15
    @ScaledMetric(relativeTo: .caption) private var hintSize: CGFloat = 12.5

    var body: some View {
        GeometryReader { geo in
            let insets = geo.safeAreaInsets
            let screen = CGSize(
                width: geo.size.width + insets.leading + insets.trailing,
                height: geo.size.height + insets.top + insets.bottom
            )
            let fold = CardTableFoldReader.fold(geo, insets: insets)
            // Closed, the Duo's system strip takes the right side; open, the mail is centred on the hinge.
            let strip = fold.isSpread ? 0 : insets.trailing + insets.leading
            let safeArea = EdgeInsets(top: insets.top, leading: insets.leading, bottom: insets.bottom, trailing: insets.trailing)
            let layout = CardTableLayout(
                screen: screen,
                trailingStrip: strip,
                safeTop: insets.top,
                bottomControls: actHeight + insets.bottom + 8,
                wordsBottom: insets.top + 54 + wordsHeight
            )
            ZStack(alignment: .topLeading) {
                MailPaper.tableNight
                measures(width: layout.width)
                if let art = model.art {
                    CardTableStage(model: model, art: art, picture: model.picture, layout: layout)
                    finger(layout)
                        .accessibilityElement()
                        .accessibilityLabel(model.spokenLabel)
                        .accessibilityIdentifier("cardTableMail")
                        // Enlarging without a pinch or a double-tap (plan 6.1).
                        .accessibilityActions {
                            if model.canZoom || model.isZoomed {
                                Button(model.isZoomed ? "Make it smaller" : "Enlarge the card") {
                                    model.toggleZoom(at: nil, layout: layout)
                                }
                            }
                        }
                }
                CardTableControls(
                    model: model,
                    menuItems: menuItems,
                    safeArea: safeArea,
                    contentWidth: layout.width,
                    wordsMaxHeight: screen.height - insets.top - 54 - layout.bottomControls - 16,
                    closeLabel: closeLabel,
                    shareLabel: shareContent.sealed ? "Share the sealed card" : "Share this card",
                    onClose: onClose,
                    onShare: canShare ? { model.isSharing = true } : nil
                )
                .frame(width: screen.width, height: screen.height, alignment: .topLeading)
            }
            .frame(width: screen.width, height: screen.height, alignment: .topLeading)
            .ignoresSafeArea()
            .onChange(of: fold, initial: true) { _, new in model.setFold(new) }
        }
        .background(MailPaper.tableNight.ignoresSafeArea())
        .statusBarHidden(false)
        .preferredColorScheme(.dark)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("cardTable")
        .task { await model.prepare() }
        .sheet(isPresented: Binding(get: { model.isSharing }, set: { model.isSharing = $0 })) {
            if let art = model.art {
                CardTableShareSheet(content: shareContent, art: art, picture: model.picture, isSender: isSender)
            }
        }
        .onAppear {
            model.reduceMotion = reduceMotion
            model.lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
            model.setShowing(true)
        }
        .onDisappear { model.setShowing(false) }
        .onChange(of: reduceMotion) { _, new in
            model.reduceMotion = new
            model.refreshRunning()
        }
        .onChange(of: scenePhase) { _, phase in model.setShowing(phase == .active) }
        .onReceive(NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)) { _ in
            model.lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
            model.refreshRunning()
        }
    }

    private var shareContent: CardTableContent {
        var content = model.content
        if sharesSealed { content.sealed = true }
        return content
    }

    /// The finger on the table: down, moved, lifted.
    private func finger(_ layout: CardTableLayout) -> some View {
        Color.clear
            .contentShape(Rectangle())
            .frame(width: layout.screen.width, height: layout.screen.height)
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .local)
                    .onChanged { value in
                        model.fingerMoved(to: value.location, layout: layout)
                    }
                    .onEnded { value in
                        let pages = model.fold.pages(screen: layout.screen, bottomRoom: model.pagesBottomRoom(layout))
                        let pose = CardTablePose(springs: model.springs, layout: layout, pages: pages)
                        let card = model.zoomedCardFrame(CGRect(
                            x: pose.cardX,
                            y: pose.cardY,
                            width: layout.cardWidth,
                            height: layout.cardHeight
                        ))
                        model.fingerLifted(at: value.location, layout: layout, isOnCard: card.contains(value.location))
                    }
            )
            // Two fingers enlarge the card (plan 6.1).
            .simultaneousGesture(
                MagnifyGesture()
                    .onChanged { value in model.pinchChanged(value.magnification, layout: layout) }
                    .onEnded { _ in model.pinchEnded() }
            )
    }

    /// The tallest the words and the button can be, so the card doesn't shift when they change.
    private func measures(width: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            Text("It opens Christmas morning, in 56 days.")
                .font(.system(size: wordsSize, design: .serif).italic())
                .lineSpacing(wordsSize * 0.15)
                .frame(width: max(0, width - 48))
                .fixedSize(horizontal: false, vertical: true)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { wordsHeight = $0 }
            CardTableAct(
                title: "Take the card out",
                hint: "or swipe it, the way you’d turn it in your hand",
                primarySize: primarySize,
                hintSize: hintSize,
                reservesSecondary: model.reservesSecondary
            ) {}
                .frame(width: max(0, width - 32))
                .fixedSize(horizontal: false, vertical: true)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { actHeight = $0 }
        }
        .hidden()
        .accessibilityHidden(true)
    }
}

/// Reads how the iPhone Duo is held from its fold, which lies across the screen as a division region (inactive while
/// it lies flat). Everything else is one page at a time, and so is the Duo open upright and flat: one large card,
/// turned over by swiping, as on a phone (plan 6.4, D2).
enum CardTableFoldReader {
    static func fold(_ geo: GeometryProxy, insets: EdgeInsets) -> CardTableFold {
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            guard let region = geo.reservedRegions(kind: .division, options: .includeInactive).first else { return .single }
            let frame = region.frame
            // The proxy's coordinates start at the safe area; the table starts at the screen's corner.
            if frame.height > frame.width {
                return .sideways(hingeX: frame.midX + insets.leading, halfClosed: region.isActive)
            }
            guard region.isActive else { return .single }
            return .upright(hingeY: frame.midY + insets.top, halfClosed: true)
        }
        #endif
        return .single
    }
}
