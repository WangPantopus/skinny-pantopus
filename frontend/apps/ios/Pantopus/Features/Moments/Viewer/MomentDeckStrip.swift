//
//  MomentDeckStrip.swift
//  Pantopus
//
//  A step deck in the viewer ("Pulse, reinvented" phase 2; CONTRACT 7g), only while the switch is on for the person
//  watching: "Step 2 of 4" under the header, one bar per step to tap or drag across (a scrub through the steps that
//  play in this ring), and, for a reader, "Save the steps", which keeps only the steps' words in their field guide. The
//  viewer holds still on a photo step, so the reader goes through the steps at their own pace; a video step plays.
//  With the switch off each step is an ordinary photo or video Moment, as today.
//

import Observation
import SwiftUI

/// The decks this person saved or let go in this run (the Moment's answer doesn't say).
@Observable
@MainActor
final class MomentDeckSaves {
    static let shared = MomentDeckSaves()

    /// The decks saved, per account (another account signed in on this phone starts with none of them).
    private var savedBy: [String: Set<String>] = [:]
    var saved: Set<String> {
        get { savedBy[MomentsComposerModel.account ?? ""] ?? [] }
        set { savedBy[MomentsComposerModel.account ?? ""] = newValue }
    }

    var sending: String?
    /// The Moment whose "Open" opened the reader's field guide over the viewer.
    var guideFrom: String?
}

extension MomentsViewerModel {
    /// The viewer holds still on a photo that is a step of a deck.
    var deckHolds: Bool {
        guard let moment, moment.layers.deck != nil else { return false }
        return moment.kind == .photo || MomentDeckSaves.shared.guideFrom == moment.id
    }
}

/// Under the header on a step of a deck.
struct MomentDeckStrip: View {
    let model: MomentsViewerModel
    @State private var flags = PulseReinventedFlags.shared
    private let saves = MomentDeckSaves.shared

    var body: some View {
        if flags.isOn, model.load == .ready, let moment = model.moment, let deck = moment.layers.deck {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Icon(.listChecks, size: 15, strokeWidth: 2.2, color: .white)
                    Text("Step \(deck.index) of \(max(deck.count, deck.steps.count))")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .accessibilityIdentifier("moments.viewer.deck.step")
                    Spacer(minLength: 8)
                    if !model.isMine {
                        save(deck, on: moment)
                    }
                }
                if deck.steps.count > 1 {
                    bars(deck, showing: moment.id)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s2)
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("moments.viewer.deck")
            // A step opened by itself (from Pulse's list or a link) brings the deck's other steps into the ring.
            .task(id: moment.id) { await model.joinDeck(deck, showing: moment.id) }
            .sheet(isPresented: Binding(get: { saves.guideFrom == moment.id }, set: { if !$0 { saves.guideFrom = nil } })) {
                MomentsFieldGuide { saves.guideFrom = nil }
                    .overViewerSheet()
            }
        }
    }

    /// One bar per step this reader may see; the one showing is filled. A tap or a drag opens a step that plays here.
    private func bars(_ deck: MomentDeckDTO, showing: String) -> some View {
        GeometryReader { geo in
            HStack(spacing: 4) {
                ForEach(Array(deck.steps.enumerated()), id: \.element) { place, id in
                    Button {
                        if id != showing { _ = model.showInRing(id) }
                    } label: {
                        Capsule()
                            .fill(id == showing ? Color.white : Color.white.opacity(model.plays(id) ? 0.45 : 0.2))
                            .frame(height: 6)
                            .frame(maxWidth: .infinity, minHeight: 28)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(!model.plays(id))
                    .accessibilityLabel("Step \(place + 1)")
                    .accessibilityValue(id == showing ? "Showing" : "")
                    .accessibilityIdentifier("moments.viewer.deck.bar.\(place + 1)")
                }
            }
            .highPriorityGesture(
                DragGesture(minimumDistance: 8).onChanged { drag in
                    let share = min(max(drag.location.x / max(geo.size.width, 1), 0), 0.999)
                    let id = deck.steps[Int(share * Double(deck.steps.count))]
                    if id != model.moment?.id, model.plays(id) { _ = model.showInRing(id) }
                }
            )
        }
        .frame(height: 28)
    }

    private func save(_ deck: MomentDeckDTO, on moment: MomentDTO) -> some View {
        let saved = saves.saved.contains(deck.id)
        return Button {
            Task { await toggle(deck, on: moment, keep: !saved) }
        } label: {
            HStack(spacing: 5) {
                Icon(saved ? .check : .bookmark, size: 13, strokeWidth: 2.4, color: .white)
                Text(saved ? "Steps saved" : "Save the steps")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 11)
            .padding(.vertical, 6)
            .background(Capsule().fill(saved ? Color.white.opacity(0.22) : Theme.Color.primarySolid))
            .hitArea(horizontal: 4, vertical: 8)
        }
        .buttonStyle(.plain)
        .disabled(saves.sending == deck.id)
        .accessibilityLabel(saved ? "Steps saved in your field guide. Tap to let them go." : "Save the steps' words in your field guide")
        .accessibilityIdentifier("moments.viewer.deck.save")
    }

    private func toggle(_ deck: MomentDeckDTO, on moment: MomentDTO, keep: Bool) async {
        saves.sending = deck.id
        defer { saves.sending = nil }
        do {
            try await StudioPlayAPI.send(StudioPlayEndpoints.saveSteps(momentId: moment.id, keep: keep))
            if keep {
                saves.saved.insert(deck.id)
                model.show(.init(text: "Saved the steps' words in your field guide", action: "Open")) { [saves] in
                    saves.guideFrom = moment.id
                }
            } else {
                saves.saved.remove(deck.id)
                model.show(.init(text: "Let the steps go"))
            }
        } catch let failure as StudioPlayFailure {
            model.show(.init(text: failure.message("The steps couldn't be saved. Try again.")))
        } catch {
            model.show(.init(text: "The steps couldn't be saved. Try again."))
        }
    }
}

/// A saved deck in the reader's field guide: each step's words, in order.
struct MomentsSavedDeckRow: View {
    let deck: SavedDeckDTO
    let onLetGo: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(deck.steps.count == 1 ? "1 step" : "\(deck.steps.count) steps")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            ForEach(deck.steps, id: \.index) { step in
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(step.index). \(step.caption ?? "Step \(step.index)")")
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    if let words = step.words, !words.isEmpty {
                        Text(words)
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
            }
            if !deck.open {
                Text("The steps have faded; their words stay here.")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Button("Let it go", role: .destructive, action: onLetGo)
                .font(.system(size: 13.5, weight: .semibold))
                .buttonStyle(.borderless)
                .accessibilityIdentifier("moments.fieldGuide.deck.letGo")
        }
        .padding(.vertical, 4)
        .swipeActions {
            Button("Let it go", role: .destructive, action: onLetGo)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.fieldGuide.deck")
    }
}

extension MomentsViewerModel {
    /// The Moment `id` plays in the ring showing, so a step's bar can open it.
    func plays(_ id: String) -> Bool {
        ring?.moments.contains { $0.id == id } ?? false
    }

    /// A step opened by itself (Pulse's list and a link open one Moment) reads the deck's other steps this reader may
    /// see and puts them in the ring, in the deck's order where the step showing is, so the bars can open them and a tap
    /// on goes to the next step. Steps that ended or that the reader can't open are left out.
    func joinDeck(_ deck: MomentDeckDTO, showing id: String) async {
        guard let ring, deck.steps.contains(where: { step in !ring.moments.contains { $0.id == step } }) else { return }
        var briefs = Dictionary(ring.moments.map { ($0.id, $0) }) { first, _ in first }
        for step in deck.steps where briefs[step] == nil {
            guard let read = try? await cache.detail(step) else { continue }
            briefs[step] = MomentBriefDTO(
                id: read.id,
                kind: read.kind,
                createdAt: read.createdAt,
                expiresAt: read.expiresAt,
                seen: false
            )
        }
        guard !Task.isCancelled, moment?.id == id, let now = self.ring,
              let at = now.moments.firstIndex(where: { $0.id == id }) else { return }
        let inDeck = Set(deck.steps)
        let joined = now.moments[..<at].filter { !inDeck.contains($0.id) }
            + deck.steps.compactMap { briefs[$0] }
            + now.moments[(at + 1)...].filter { !inDeck.contains($0.id) }
        guard joined.count != now.moments.count, let index = joined.firstIndex(where: { $0.id == id }) else { return }
        joinRing(joined, showing: index)
    }

    /// Opens the Moment `id` of the ring showing, if it plays in it. Today's screens never call it.
    func showInRing(_ id: String) -> Bool {
        guard let index = ring?.moments.firstIndex(where: { $0.id == id }) else { return false }
        momentIndex = index
        retry()
        return true
    }
}
