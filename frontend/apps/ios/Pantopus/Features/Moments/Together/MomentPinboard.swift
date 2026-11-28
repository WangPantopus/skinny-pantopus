//
//  MomentPinboard.swift
//  Pantopus
//
//  Pinboards ("Pulse, reinvented" phase 3, PHASE-3 piece 3; CONTRACT 8i): add your piece to a shared prompt, such as
//  "Best fall tree on your walk". A pinboard is its first photo and the pieces people add for a week, one each; it
//  stays. In Pulse it is one row ("Pinboard · 4 pieces") that opens the board; in the viewer a chip opens it too.
//  "Add your piece" opens the Studio with the prompt in its drawer. A tap on a piece plays that piece in the viewer, and
//  closing the viewer comes back to the board (LEAD-8, 11-28 10:37): from the list, the board steps aside for the Pulse
//  tab's own viewer (`ReinventedStudioCover`; a cover presented from inside the tab's stack closed again as the viewer
//  turned the screen dark) and opens again once that viewer has gone; over a viewer, the piece plays in a full-height
//  sheet over the board (a cover would take the viewer under it out of the window, and it would close the board as it
//  came back). Only while the switch is on. Words as the web's.
//

import Observation
import SwiftUI

/// `pinboard` on a Moment answer (switch on): the pinboard this Moment starts or is a piece of.
struct MomentPinboardDTO: Decodable, Hashable {
    let startId: String
    let prompt: String
    let pieces: Int
    let open: Bool
    let isStart: Bool

    private enum CodingKeys: String, CodingKey {
        case prompt, pieces, open
        case startId = "start_id"
        case isStart = "is_start"
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        startId = try c.decode(String.self, forKey: .startId)
        prompt = (try? c.decodeIfPresent(String.self, forKey: .prompt)) ?? ""
        pieces = (try? c.decodeIfPresent(Int.self, forKey: .pieces)) ?? 1
        open = (try? c.decodeIfPresent(Bool.self, forKey: .open)) ?? false
        isStart = (try? c.decodeIfPresent(Bool.self, forKey: .isStart)) ?? false
    }

    /// "Pinboard · 4 pieces".
    var tag: String {
        "Pinboard · \(pieces) \(pieces == 1 ? "piece" : "pieces")"
    }
}

/// `GET /api/reinvented/pinboards/:id`: the prompt and the pieces this reader may see, newest first.
struct PinboardDTO: Decodable {
    struct Piece: Decodable, Identifiable, Hashable {
        let id: String
        let author: MomentAuthorDTO?
        let picture: URL?

        private enum CodingKeys: String, CodingKey {
            case id, author
            case thumbURL = "thumb_url"
            case mediaURL = "media_url"
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = try c.decode(String.self, forKey: .id)
            author = try? c.decodeIfPresent(MomentAuthorDTO.self, forKey: .author)
            let media: String? = try? c.decodeIfPresent(String.self, forKey: .mediaURL)
            let thumb: String? = try? c.decodeIfPresent(String.self, forKey: .thumbURL)
            picture = (media ?? thumb).flatMap(URL.init(string:))
        }
    }

    let startId: String
    let prompt: String
    let startedBy: MomentAuthorDTO?
    let openUntil: Date?
    let open: Bool
    let pieces: [Piece]
    let canAdd: Bool

    private enum CodingKeys: String, CodingKey {
        case prompt, open, pieces
        case startId = "start_id"
        case startedBy = "started_by"
        case openUntil = "open_until"
        case canAdd = "can_add"
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        startId = try c.decode(String.self, forKey: .startId)
        prompt = (try? c.decodeIfPresent(String.self, forKey: .prompt)) ?? ""
        startedBy = try? c.decodeIfPresent(MomentAuthorDTO.self, forKey: .startedBy)
        openUntil = MomentTime.parse(try? c.decodeIfPresent(String.self, forKey: .openUntil))
        open = (try? c.decodeIfPresent(Bool.self, forKey: .open)) ?? false
        pieces = (try? c.decodeIfPresent([Piece].self, forKey: .pieces)) ?? []
        canAdd = (try? c.decodeIfPresent(Bool.self, forKey: .canAdd)) ?? false
    }
}

private struct PinboardEnvelope: Decodable {
    let pinboard: PinboardDTO
}

enum PinboardEndpoints {
    /// `GET /api/reinvented/pinboards/:id` (the start's id or any piece's). Route `backend/routes/reinvented.js`.
    static func pinboard(_ id: String) -> Endpoint {
        Endpoint(
            method: .get,
            path: "/api/reinvented/pinboards/\(id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id)",
            cachePolicy: .reloadIgnoringLocalCacheData
        )
    }
}

/// The pinboard open, from Pulse's list (`fromList`) or from the viewer, one at a time.
@Observable
@MainActor
final class PinboardPrompt {
    static let shared = PinboardPrompt()

    struct Open: Identifiable, Equatable {
        let id: String
    }

    var fromList: Open?
    var inViewer: Open?
    /// The viewer playing a piece of a board: it plays on although a board may be open under it, and shows no pinboard
    /// chip (the board is where it came from).
    private(set) var piece: ObjectIdentifier?
    /// A piece played from a board open over a viewer: it plays over that board.
    private(set) var overBoard: MomentsWatchSession?
    /// A piece played from the list's board waits for the board to close, plays in the Pulse tab's viewer, and the board
    /// opens again when that viewer closes.
    @ObservationIgnored private var waiting: MomentsWatchSession?
    @ObservationIgnored private var returnTo: Open?

    func isPiece(_ model: MomentsViewerModel) -> Bool {
        piece == ObjectIdentifier(model)
    }

    /// A tap on a piece of the board `startId`, read and ready to play.
    func play(_ session: MomentsWatchSession, from startId: String) {
        piece = ObjectIdentifier(session.model)
        if inViewer != nil {
            overBoard = session
            return
        }
        waiting = session
        returnTo = Open(id: startId)
        fromList = nil
    }

    /// The list's board has closed (`onDismiss`): a piece waiting for it plays now.
    func boardClosed() {
        guard let session = waiting else { return }
        waiting = nil
        ReinventedViewerPresenter.shared.watching = session
    }

    /// The Pulse tab's viewer closed: back to the board its piece came from, once the viewer has gone (a sheet presented
    /// while it leaves would keep its dark).
    func viewerClosed() {
        piece = nil
        guard let board = returnTo else { return }
        returnTo = nil
        Task {
            try? await Task.sleep(for: .milliseconds(500))
            fromList = board
        }
    }

    /// The piece over a board open over a viewer closed: the board is there again.
    func closeOverBoard() {
        guard overBoard != nil else { return }
        overBoard = nil
        piece = nil
    }

    /// A Moment of a pinboard opens the board (switch on); anything else opens as before.
    func opens(_ moment: MomentDTO) -> Bool {
        guard PulseReinventedFlags.shared.isOn, let board = moment.together.pinboard else { return false }
        fromList = Open(id: board.startId)
        return true
    }

    /// "Add your piece": the Studio opens over Pulse with the prompt in its drawer, once whatever was in front has closed.
    func addPiece(to board: PinboardDTO) {
        fromList = nil
        inViewer = nil
        TogetherStudio.shared.reset()
        TogetherStudio.shared.context = .pinboardPiece(startId: board.startId, prompt: board.prompt)
        Task {
            try? await Task.sleep(for: .milliseconds(600))
            ReinventedStudioPresenter.shared.composing = MomentsComposeRequest(model: MomentsComposerModel(), studio: true)
        }
    }
}

/// Pulse's list opens a pinboard here (`ReinventedPulseView`).
struct MomentPinboardListSheet: ViewModifier {
    @State private var prompt = PinboardPrompt.shared
    @State private var viewer = ReinventedViewerPresenter.shared

    func body(content: Content) -> some View {
        content
            .sheet(
                item: $prompt.fromList,
                onDismiss: { prompt.boardClosed() },
                content: { open in
                    MomentPinboardView(id: open.id) { prompt.addPiece(to: $0) }
                        .presentationDetents([.large])
                        .presentationDragIndicator(.visible)
                }
            )
            .onChange(of: viewer.closings) { _, _ in prompt.viewerClosed() }
    }
}

/// The pinboard: its prompt, who started it, its pieces newest first, and "Add your piece" while it is open.
struct MomentPinboardView: View {
    let id: String
    let onAdd: (PinboardDTO) -> Void
    @State private var board: PinboardDTO?
    @State private var failed = false
    /// The piece being opened, and a line when one couldn't open.
    @State private var opening: String?
    @State private var pieceNote: String?
    @State private var prompt = PinboardPrompt.shared
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                header
                if let board {
                    pieces(board.pieces)
                    if let pieceNote { note(pieceNote) }
                    if board.canAdd {
                        Button { onAdd(board) } label: {
                            Text("Add your piece")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity, minHeight: 44)
                                .background(Capsule().fill(Theme.Color.primarySolid))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("together.pinboard.add")
                    } else {
                        note(board.open ? "You’ve added your piece." : "This pinboard has closed.")
                    }
                } else {
                    note(failed ? "This pinboard couldn’t load." : "Loading…")
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.s4)
        }
        .background(Theme.Color.appBg)
        .task(id: id) { await read() }
        .accessibilityIdentifier("together.pinboard")
        // Over a viewer the piece plays over the board (from the list it plays in the Pulse tab's viewer instead).
        .sheet(item: Binding(get: { prompt.overBoard }, set: { if $0 == nil { prompt.closeOverBoard() } })) { session in
            MomentsViewer(
                session: session,
                systemScheme: colorScheme,
                stopsOnDisappear: true,
                onHideAuthor: { _ in },
                onShowAuthor: { _ in },
                onClose: { prompt.closeOverBoard() }
            )
            .presentationDetents([.large])
            .presentationBackground(.black)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Pinboard")
                .font(.system(size: 12.5, weight: .bold))
                .foregroundStyle(Theme.Color.primaryTint)
                .textCase(.uppercase)
            Text(board?.prompt ?? "…")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            if let board {
                Text(subtitle(board))
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    /// "Started by Ivy Sato · 4 pieces · open until Tue, Dec 2", or "… · closed".
    private func subtitle(_ board: PinboardDTO) -> String {
        let count = board.pieces.count
        let until = board.openUntil.map { "open until \($0.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))" }
        return [
            "Started by \(board.startedBy?.name ?? "someone")",
            "\(count) \(count == 1 ? "piece" : "pieces")",
            board.open ? (until ?? "open") : "closed"
        ].joined(separator: " · ")
    }

    private func pieces(_ pieces: [PinboardDTO.Piece]) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: Spacing.s2), GridItem(.flexible(), spacing: Spacing.s2)], spacing: Spacing.s2) {
            ForEach(pieces) { piece in
                Button { open(piece) } label: { tile(piece) }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(piece.author?.name ?? "Someone")’s piece")
                    .accessibilityHint("Plays the piece")
                    .accessibilityIdentifier("together.pinboard.piece")
            }
        }
    }

    private func tile(_ piece: PinboardDTO.Piece) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Color.clear
                .frame(maxWidth: .infinity)
                .frame(height: 180)
                .overlay {
                    AsyncImage(url: piece.picture) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Theme.Color.appSurfaceSunken
                    }
                }
                .overlay {
                    if opening == piece.id { ProgressView().tint(.white) }
                }
                .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            Text(piece.author?.name ?? "Someone")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(1)
        }
        .contentShape(Rectangle())
    }

    /// A piece is a Moment the reader may see: read it and play it.
    private func open(_ piece: PinboardDTO.Piece) {
        guard opening == nil, prompt.overBoard == nil, let startId = board?.startId else { return }
        opening = piece.id
        pieceNote = nil
        Task {
            defer { opening = nil }
            do {
                let moment = try await MomentsAPI.send(MomentsEndpoints.moment(id: piece.id), as: MomentEnvelope.self).moment
                var me: String?
                if case let .signedIn(user) = AuthManager.shared.state { me = user.id }
                let ring = MomentRingDTO(moment: moment, mine: moment.author.id == me)
                let session = MomentsWatchSession(request: MomentsWatchRequest(rings: [ring], start: 0, newOnly: false)) { _ in }
                prompt.play(session, from: startId)
            } catch {
                let failure = error as? MomentsFailure
                pieceNote = failure == .ended || failure == .notFound ? "This piece isn’t there any more."
                    : failure?.message ?? "This piece couldn’t open."
                await PulseReinventedFlags.shared.recheck()
            }
        }
    }

    private func note(_ words: String) -> some View {
        Text(words)
            .font(.system(size: 14))
            .foregroundStyle(Theme.Color.appTextSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func read() async {
        do {
            let answer: PinboardEnvelope = try await MomentsAPI.send(PinboardEndpoints.pinboard(id))
            board = answer.pinboard
        } catch {
            failed = true
            await PulseReinventedFlags.shared.recheck()
        }
    }
}

/// In the viewer's chip row: "Pinboard · 4 pieces", opening the board over the viewer.
struct MomentPinboardChip: View {
    let model: MomentsViewerModel
    @State private var prompt = PinboardPrompt.shared

    var body: some View {
        if PulseReinventedFlags.shared.isOn, let board = model.moment?.together.pinboard, !prompt.isPiece(model) {
            Button { prompt.inViewer = .init(id: board.startId) } label: {
                HStack(spacing: 6) {
                    Icon(.layoutGrid, size: 15, strokeWidth: 2.2, color: .white)
                    Text(board.tag)
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(.white)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Capsule().fill(Color.black.opacity(0.45)))
                .overlay(Capsule().stroke(Color.white.opacity(0.35), lineWidth: 1))
                .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens the pinboard's pieces")
            .accessibilityIdentifier("moments.viewer.pinboard")
            .sheet(item: $prompt.inViewer) { open in
                MomentPinboardView(id: open.id) { board in
                    model.close()
                    prompt.addPiece(to: board)
                }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
            }
        }
    }
}

extension MomentsViewerModel {
    /// The viewer holds still while a pinboard is open over it; the piece playing over that board plays.
    var pinboardOpen: Bool {
        PinboardPrompt.shared.inViewer != nil && !PinboardPrompt.shared.isPiece(self)
    }
}
