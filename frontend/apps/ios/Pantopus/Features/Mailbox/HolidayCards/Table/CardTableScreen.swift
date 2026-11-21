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
    /// "Share this card" as a quiet button too (plan 11.1); off on a reader's card, where the quiet row holds the
    /// design check's three (Nov 17) and Share keeps its corner and its ⋯ line.
    var sharesQuietly = true
    let onClose: () -> Void

    @State private var wordsHeight: CGFloat = 0
    @State private var actHeight: CGFloat = 0
    /// With larger text: "Turn it back" and "Read it in print" side by side, or one under the other (plan Part 2).
    @State private var printActHeight: CGFloat = 0
    /// A travelling card: "Turn it back" with "Pass it on" beside it (travelling card plan Part 4).
    @State private var passActHeight: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @ScaledMetric(relativeTo: .title3) private var wordsSize: CGFloat = 18
    @ScaledMetric(relativeTo: .footnote) private var smallSize: CGFloat = 13.5
    @ScaledMetric(relativeTo: .subheadline) private var primarySize: CGFloat = 15
    @ScaledMetric(relativeTo: .caption) private var hintSize: CGFloat = 15

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
                bottomControls: max(actHeight, model.largerText ? printActHeight : 0, model.travelButtons.passOn == nil ? 0 : passActHeight)
                    + insets.bottom + 8,
                // The card's own photo and greeting keep room under the turned-over card on a phone (memories plan
                // step 4); nothing lies there while a card is being sealed.
                keepsMediaRoom: model.sending == nil
                    && CardTableMediaLayer.liesUnderCard(model.content, screen: screen, strip: strip, fold: fold),
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
                    CardTableMediaLayer(model: model, layout: layout)
                        .frame(width: screen.width, height: screen.height, alignment: .topLeading)
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
        // The card's own photo, opened from its print: over the table and its buttons.
        .overlay {
            if let photo = model.openedPhoto {
                CardPhotoViewer(photo: photo) { model.openedPhoto = nil }
                    .accessibilityAddTraits(.isModal)
            }
        }
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
            model.offersShare = canShare && sharesQuietly
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
                        // The open Duo's note page, where a long note's first leaf lies (plan Part 9).
                        let scale = pose.cardScale * pose.pageScale
                        let notePage = CGRect(
                            x: pose.notePageX,
                            y: pose.notePageY,
                            width: layout.cardWidth * scale,
                            height: layout.cardHeight * scale
                        )
                        let onCard = card.contains(value.location) || (model.fold.isSpread && notePage.contains(value.location))
                        model.fingerLifted(at: value.location, layout: layout, isOnCard: onCard)
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
            VStack(spacing: 7) {
                Text("It opens Christmas morning, in 56 days.")
                    .font(.system(size: wordsSize, design: .serif).italic())
                    .lineSpacing(wordsSize * 0.15)
                // A travelling card keeps room for how far it came (travelling card plan Part 3).
                if model.content.travel?.cameLine != nil {
                    Text("It came 12,345 miles through 10 towns to reach you.")
                        .font(.system(size: smallSize))
                        .lineSpacing(smallSize * 0.2)
                }
            }
            .frame(width: max(0, width - 48))
            .fixedSize(horizontal: false, vertical: true)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { wordsHeight = $0 }
            CardTableAct(
                title: "Take the card out",
                hint: "or swipe it, the way you’d turn it in your hand",
                primarySize: primarySize,
                hintSize: hintSize,
                reservesSecondary: model.reservesSecondary || model.reservesNext,
                oneRow: true
            ) {}
                .frame(width: max(0, width - 32))
                .fixedSize(horizontal: false, vertical: true)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { actHeight = $0 }
            CardTableAct(
                title: "Turn it back",
                hint: "",
                primarySize: primarySize,
                hintSize: hintSize,
                reservesSecondary: model.reservesSecondary || model.reservesNext,
                oneRow: true,
                beside: CardTableMenuItem(title: CardTableBookmark.print.title, identifier: "") {}
            ) {}
                .frame(width: max(0, width - 32))
                .fixedSize(horizontal: false, vertical: true)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { printActHeight = $0 }
            if model.travelButtons.passOn != nil {
                CardTableAct(
                    title: "Turn it back",
                    hint: "",
                    primarySize: primarySize,
                    hintSize: hintSize,
                    reservesSecondary: model.reservesSecondary || model.reservesNext,
                    oneRow: true,
                    passOn: CardTableMenuItem(title: "Pass it on to one more", identifier: "") {},
                    beside: model.largerText ? CardTableMenuItem(title: CardTableBookmark.print.title, identifier: "") {} : nil
                ) {}
                    .frame(width: max(0, width - 32))
                    .fixedSize(horizontal: false, vertical: true)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { passActHeight = $0 }
            }
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
