//
//  PlaceFridgeCardSection.swift
//  Pantopus
//
//  The Fridge Card on the Risk & readiness detail: compose the
//  911-ready household card (shutoffs pre-seeded from the home's
//  existing emergency info), issue — the card link is copied — and
//  manage the home's cards (views, copy, revoke). Issuing FREEZES the
//  card; revoking pulls its content entirely. Mirrors web's
//  FridgeCardLeaf; parity: Android PlaceFridgeCardContent.
//

import SwiftUI
import UIKit

// MARK: - VM

@Observable
@MainActor
final class PlaceFridgeCardViewModel {
    enum State {
        case loading
        case loaded([FridgeCard])
        case error(message: String)
    }

    private(set) var state: State = .loading
    private(set) var isIssuing = false
    // (message, isError): a failed issue must never render in
    // confirmation green — the person may believe a link was copied.
    private(set) var toast: (message: String, isError: Bool)?
    var label = ""
    var drafts: [FridgeCardSectionKey: [FridgeCardItem]] = [:]
    private var seeded = false
    let homeId: String
    private let api: APIClient

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    var hasContent: Bool {
        drafts.values.contains { items in
            items.contains { !$0.label.isEmpty || !$0.note.isEmpty }
        }
    }

    func load() async {
        do {
            let response: FridgeCardsResponse = try await api.request(
                FridgeCardsEndpoints.list(homeId: homeId)
            )
            state = .loaded(response.cards)
        } catch let error as APIError {
            state = .error(message: error.errorDescription ?? "Couldn't load the cards.")
        } catch {
            state = .error(message: "Couldn't load the cards.")
        }
        await seedUtilities()
    }

    /// Passive derivation: the home's existing emergency info (gas and
    /// water shutoffs…) pre-seeds the utilities section once, so the
    /// card starts half-full, not blank.
    private func seedUtilities() async {
        guard !seeded, drafts[.utilities, default: []].isEmpty else { return }
        seeded = true
        guard let response: GetHomeEmergenciesResponse = try? await api.request(
            HomesEndpoints.emergencies(homeId: homeId)
        ) else { return }
        let items = response.emergencies
            .filter { !$0.label.isEmpty }
            .prefix(12)
            .map { FridgeCardItem(label: $0.label, note: $0.location ?? "") }
        if !items.isEmpty {
            drafts[.utilities] = Array(items)
        }
    }

    func addItem(_ key: FridgeCardSectionKey) {
        guard drafts[key, default: []].count < 12 else { return }
        drafts[key, default: []].append(FridgeCardItem(label: "", note: ""))
    }

    func updateItem(_ key: FridgeCardSectionKey, index: Int, label: String, note: String) {
        guard drafts[key, default: []].indices.contains(index) else { return }
        drafts[key]?[index] = FridgeCardItem(label: label, note: note)
    }

    func removeItem(_ key: FridgeCardSectionKey, index: Int) {
        guard drafts[key, default: []].indices.contains(index) else { return }
        drafts[key]?.remove(at: index)
    }

    func issue() async {
        isIssuing = true
        defer { isIssuing = false }
        let sections = FridgeCardSectionKey.allCases.compactMap { key -> IssueFridgeCardSection? in
            let items = drafts[key, default: []].filter { !$0.label.isEmpty || !$0.note.isEmpty }
            return items.isEmpty ? nil : IssueFridgeCardSection(key: key, items: items)
        }
        guard !sections.isEmpty else { return }
        do {
            let response: FridgeCardResponse = try await api.request(
                FridgeCardsEndpoints.issue(
                    homeId: homeId,
                    request: IssueFridgeCardRequest(
                        label: label.trimmingCharacters(in: .whitespaces).isEmpty ? nil : label,
                        sections: sections
                    )
                )
            )
            UIPasteboard.general.string = response.card.cardUrl
            toast = ("Card issued — link copied. Open it to print for the fridge.", false)
            await load()
        } catch let error as APIError {
            toast = (error.errorDescription ?? "Couldn't issue the card.", true)
        } catch {
            toast = ("Couldn't issue the card.", true)
        }
    }

    func copyLink(_ card: FridgeCard) {
        UIPasteboard.general.string = card.cardUrl
        toast = ("Card link copied.", false)
    }

    func revoke(_ cardId: String) async {
        do {
            _ = try await api.request(
                FridgeCardsEndpoints.revoke(homeId: homeId, cardId: cardId)
            ) as FridgeCardResponse
            toast = ("Card revoked — its page now shows none of its content.", false)
            await load()
        } catch let error as APIError {
            // A swallowed revoke is the worst possible silence on this
            // surface: the resident taps Revoke on a leaked card holding
            // their household's medical details, sees nothing change,
            // and reasonably concludes it worked. A member without
            // can_manage_home hits exactly this (403).
            toast = (error.errorDescription ?? "Couldn't revoke the card.", true)
            await load()
        } catch {
            toast = ("Couldn't revoke the card.", true)
            await load()
        }
    }

    func clearToast() {
        toast = nil
    }
}

// MARK: - Section metadata

private let sectionMeta: [FridgeCardSectionKey: (title: String, placeholder: FridgeCardItem)] = [
    .household: ("Household", FridgeCardItem(label: "Mia (6)", note: "Peanut allergy — EpiPen in the pantry")),
    .medical: ("Medical", FridgeCardItem(label: "Dana", note: "Type 1 diabetic — insulin in fridge door")),
    .pets: ("Pets", FridgeCardItem(label: "Biscuit", note: "Golden retriever, friendly")),
    .utilities: ("Shutoffs & utilities", FridgeCardItem(label: "Gas shutoff", note: "Left side of the house")),
    .contacts: ("Emergency contacts", FridgeCardItem(label: "Grandma Ana", note: "503-555-0101")),
    .notes: ("Notes", FridgeCardItem(label: "Spare key", note: "Lockbox by the side gate")),
]

// MARK: - Section

struct PlaceFridgeCardSection: View {
    @Bindable var vm: PlaceFridgeCardViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            composer
            cardsList
            if let toast = vm.toast {
                Text(toast.message)
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(toast.isError ? Theme.Color.error : Theme.Color.success)
                    .task {
                        try? await Task.sleep(for: .seconds(3))
                        vm.clearToast()
                    }
            }
        }
    }

    private var composer: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("The 911-ready household card")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text(
                    "Everything a sitter needs to say on a 911 call — starting with your exact address, "
                        + "which the card always shows. Read by people you hand it to; never sent to dispatch."
                )
                .font(.system(size: 12.5))
                .lineSpacing(2)
                .foregroundStyle(Theme.Color.appTextSecondary)
                TextField("Card name — e.g. Sitter card", text: $vm.label)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 14))
                ForEach(FridgeCardSectionKey.allCases, id: \.self) { key in
                    sectionEditor(key)
                }
                Button {
                    Task { await vm.issue() }
                } label: {
                    Text(vm.isIssuing ? "Issuing…" : "Issue card & copy link")
                        .font(.system(size: 14.5, weight: .semibold))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(vm.isIssuing || !vm.hasContent)
                Text("Issuing freezes the card exactly as entered. To change it later, issue a fresh card and revoke the old one.")
                    .font(.system(size: 11.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
    }

    private func sectionEditor(_ key: FridgeCardSectionKey) -> some View {
        let meta = sectionMeta[key] ?? ("Notes", FridgeCardItem(label: "", note: ""))
        let items = vm.drafts[key, default: []]
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(meta.title.uppercased())
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextMuted)
                Spacer(minLength: 0)
                Button("Add") { vm.addItem(key) }
                    .font(.system(size: 12.5, weight: .semibold))
                    .disabled(items.count >= 12)
            }
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                itemRow(key, index: index, item: item, placeholder: meta.placeholder)
            }
        }
    }

    private func itemRow(
        _ key: FridgeCardSectionKey,
        index: Int,
        item: FridgeCardItem,
        placeholder: FridgeCardItem
    ) -> some View {
        HStack(spacing: 6) {
            TextField(placeholder.label, text: Binding(
                get: { item.label },
                set: { vm.updateItem(key, index: index, label: $0, note: item.note) }
            ))
            .textFieldStyle(.roundedBorder)
            .font(.system(size: 13))
            .frame(width: 110)
            TextField(placeholder.note, text: Binding(
                get: { item.note },
                set: { vm.updateItem(key, index: index, label: item.label, note: $0) }
            ))
            .textFieldStyle(.roundedBorder)
            .font(.system(size: 13))
            Button {
                vm.removeItem(key, index: index)
            } label: {
                Icon(.x, size: 13, strokeWidth: 2.25, color: Theme.Color.appTextMuted)
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private var cardsList: some View {
        switch vm.state {
        case .loading:
            EmptyView()
        case let .error(message):
            PlaceDetailCard {
                Text(message)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        case let .loaded(cards):
            ForEach(cards) { card in
                PlaceFridgeCardRow(card: card, vm: vm)
            }
        }
    }
}

// MARK: - One issued card

private struct PlaceFridgeCardRow: View {
    let card: FridgeCard
    let vm: PlaceFridgeCardViewModel

    private var opensLine: String {
        card.viewCount == 0
            ? "Not opened yet"
            : "Opened \(card.viewCount) \(card.viewCount == 1 ? "time" : "times")"
    }

    var body: some View {
        PlaceDetailCard(padding: 14) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text(card.label ?? "Fridge card")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: 0)
                    PlaceChip(model: card.status == .active
                        ? PlaceChipModel(tone: .success, text: "Active")
                        : PlaceChipModel(tone: .warning, text: "Revoked"))
                }
                Text("\(PlacePresentation.fmtMonthYear(card.issuedAt) ?? "") · \(opensLine)")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
                if card.status == .active {
                    HStack(spacing: 8) {
                        Button {
                            vm.copyLink(card)
                        } label: {
                            Text("Copy link")
                                .font(.system(size: 13, weight: .semibold))
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        Button(role: .destructive) {
                            Task { await vm.revoke(card.id) }
                        } label: {
                            Text("Revoke")
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
        }
    }
}
