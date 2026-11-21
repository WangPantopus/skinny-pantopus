//
//  HolidayCardTravelViews.swift
//  Pantopus
//
//  Letting a card travel (server switch `card_travel`, travelling card plan Part 2): "Let it travel" on "Seal it for
//  the day", under the arrival choices on the same paper, and the one small sheet that asks someone with no town yet
//  "Where does it start?" (D4: asked once, kept in their profile's town fields). The switch shows only when the
//  server's cards answer says travel is on.
//

import SwiftUI

/// "Let it travel" and its line, on the arrival choices' cream slip.
struct HolidayCardTravelRow: View {
    @Binding var isOn: Bool
    /// "Maya", or nil for an address or a link ("They").
    let firstName: String?

    var body: some View {
        Toggle(isOn: $isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Let it travel")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(MailPaper.cardText)
                Text(HolidayCardTravelWords.switchLine(firstName))
                    .font(.system(size: 13))
                    .foregroundStyle(MailPaper.cardTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .tint(MailPaper.wax)
        .padding(14)
        .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(MailPaper.cardRowEdge, lineWidth: 1))
        .accessibilityIdentifier("sendCardLetItTravel")
    }
}

enum HolidayCardTravelWords {
    /// "Maya can pass this card on. Its towns show on a map, never names."
    static func switchLine(_ firstName: String?) -> String {
        "\(firstName ?? "They") can pass this card on. Its towns show on a map, never names."
    }

    /// The line "On its way to Maya" gains once a travelling card is sent.
    static let sentLine = "It can travel. You’ll hear when it reaches a town."
}

/// "Where does it start?": a field, "Your town or ZIP code", the matches, and "Use Vancouver, WA" when the server
/// suggests a town. A tap keeps the town in the profile (`PUT /api/mailbox/cards/town`) and hands it back.
struct CardTravelTownSheet: View {
    let onChosen: (CardTownMatch) -> Void
    let onCancel: () -> Void

    @State private var query = ""
    @State private var matches: [CardTownMatch] = []
    @State private var suggested: CardTownMatch?
    /// The town being kept.
    @State private var saving: String?
    @State private var refusal: String?
    @State private var lookFailed = false
    @FocusState private var focused: Bool

    private var typed: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Where does it start?")
                        .font(.system(size: 21, design: .serif))
                        .foregroundStyle(MailPaper.cardText)
                        .accessibilityAddTraits(.isHeader)
                    Spacer(minLength: Spacing.s2)
                    Button("Cancel", action: onCancel)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(MailPaper.cardLink)
                        .frame(minHeight: 44)
                        .accessibilityIdentifier("cardTownCancel")
                }
                field
                if let suggested, typed.isEmpty {
                    HolidayCardWaxButton(title: "Use \(suggested.label)", isLoading: saving == suggested.id) {
                        Task { await keep(suggested) }
                    }
                    .accessibilityIdentifier("cardTownSuggested")
                }
                if !matches.isEmpty {
                    VStack(spacing: Spacing.s0) {
                        ForEach(Array(matches.enumerated()), id: \.element.id) { index, match in
                            if index > 0 { Rectangle().fill(MailPaper.cardRowLine).frame(height: 1) }
                            townRow(match)
                        }
                    }
                    .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(MailPaper.cardRowEdge, lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                } else if typed.count >= 2, !lookFailed {
                    Text("No town by that name. Try its ZIP code.")
                        .font(.system(size: 14))
                        .foregroundStyle(MailPaper.cardTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let refusal {
                    Text(refusal)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(MailPaper.warningInk)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("cardTownRefusal")
                }
            }
            .padding(Spacing.s4)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(MailPaper.letter.ignoresSafeArea())
        .environment(\.colorScheme, .light)
        .task(id: typed) { await look() }
        .accessibilityIdentifier("cardTownSheet")
    }

    private var field: some View {
        TextField("", text: $query, prompt: Text("Your town or ZIP code").foregroundStyle(MailPaper.cardTextMuted))
            .font(.system(size: 16))
            .foregroundStyle(MailPaper.cardText)
            .textInputAutocapitalization(.words)
            .autocorrectionDisabled()
            .textContentType(.addressCity)
            .submitLabel(.search)
            .focused($focused)
            .padding(.horizontal, Spacing.s4)
            .frame(minHeight: 48)
            .typesInFieldOnTap($focused)
            .background(MailPaper.cardField, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(focused ? MailPaper.wax : MailPaper.cardFieldEdge, lineWidth: 1)
            )
            .accessibilityLabel("Your town or ZIP code")
            .accessibilityIdentifier("cardTownField")
    }

    private func townRow(_ match: CardTownMatch) -> some View {
        Button {
            Task { await keep(match) }
        } label: {
            HStack(spacing: Spacing.s2) {
                Text(match.label)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(MailPaper.cardText)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: Spacing.s2)
                if saving == match.id {
                    ProgressView().controlSize(.small)
                } else if let zip = match.zip {
                    Text(zip)
                        .font(.system(size: 13))
                        .foregroundStyle(MailPaper.cardTextMuted)
                }
            }
            .padding(.horizontal, Spacing.s4)
            .frame(minHeight: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(saving != nil)
        .accessibilityIdentifier("cardTown.\(match.id)")
    }

    /// The matches for what's typed; with nothing typed, the suggested town.
    private func look() async {
        let text = typed
        let digits = text.allSatisfy(\.isNumber)
        guard text.isEmpty || (digits ? text.count >= 3 : text.count >= 2) else {
            matches = []
            return
        }
        if !text.isEmpty {
            try? await Task.sleep(nanoseconds: 250_000_000)
            guard !Task.isCancelled else { return }
        }
        do {
            let answer: CardTownsResponse = try await APIClient.shared.request(HolidayCardEndpoints.towns(query: text.isEmpty ? nil : text))
            guard !Task.isCancelled else { return }
            lookFailed = false
            matches = answer.towns
            if text.isEmpty { suggested = answer.suggested }
        } catch {
            guard !Task.isCancelled else { return }
            lookFailed = true
            refusal = HolidayCardFlowViewModel.refusal(error, fallback: "Couldn’t find towns just now. Try again in a moment.")
        }
        if text.isEmpty, suggested == nil {
            try? await Task.sleep(nanoseconds: 300_000_000)
            focused = true
        }
    }

    private func keep(_ match: CardTownMatch) async {
        guard saving == nil else { return }
        saving = match.id
        refusal = nil
        focused = false
        defer { saving = nil }
        do {
            let _: CardTownAnswer = try await APIClient.shared.request(HolidayCardEndpoints.setTown(CardTownBody(match)))
            onChosen(match)
        } catch {
            refusal = HolidayCardFlowViewModel.refusal(error, fallback: "Couldn’t keep your town just now. Try again in a moment.")
        }
    }
}
