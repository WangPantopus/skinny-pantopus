//
//  EmergencyInfoView.swift
//  Pantopus
//
//  T6.4b / P17 — Concrete List-of-Rows screen backed by
//  `EmergencyInfoViewModel`. Wired to
//  `GET /api/homes/:id/emergencies` (route `backend/routes/home.js:5406`).
//
//  The standing red "Emergency? Call 911" bar sits in the shell's
//  `customHeader` slot, directly under the chip strip — the same place
//  RN pins it under the header (`emergency.tsx:106-110`). It dials, as
//  does every stored contact's phone number.
//

import SwiftUI

struct EmergencyInfoView: View {
    @State private var viewModel: EmergencyInfoViewModel
    @State private var shareText: ShareTextItem?
    @State private var cardPDF: CardPDFItem?
    @Environment(\.openURL) private var openURL

    init(viewModel: EmergencyInfoViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        ListOfRowsView(dataSource: viewModel) {
            EmergencyCall911Banner { viewModel.dialEmergencyNumber() }
        }
        .accessibilityIdentifier("emergencyInfoList")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .onAppear { Analytics.track(.screenEmergencyInfoViewed) }
        .onChange(of: viewModel.shareRequested) { _, requested in
            guard requested else { return }
            viewModel.shareRequested = false
            if let text = viewModel.shareSummaryText() {
                shareText = ShareTextItem(text: text)
            }
        }
        .onChange(of: viewModel.printRequested) { _, requested in
            guard requested else { return }
            viewModel.printRequested = false
            if let card = viewModel.printableCard(), let url = EmergencyCardPDF.render(card) {
                cardPDF = CardPDFItem(url: url)
            }
        }
        .onChange(of: viewModel.dialRequest) { _, number in
            guard let number else { return }
            viewModel.dialRequest = nil
            if let url = telURL(for: number) { openURL(url) }
        }
        .sheet(item: $shareText) { item in
            SystemShareSheet(items: [item.text])
        }
        .sheet(item: $cardPDF) { item in
            SystemShareSheet(items: [item.url])
        }
    }

    /// `tel:` URL for a stored number. Strips formatting so
    /// "(415) 555-0134" still dials. Mirrors the Android `telUri` helper.
    private func telURL(for number: String) -> URL? {
        let digits = number.filter { $0.isNumber || $0 == "+" }
        guard !digits.isEmpty else { return nil }
        return URL(string: "tel:\(digits)")
    }
}

// MARK: - Standing 911 bar

/// Full-bleed red call bar. RN keeps it visible above the list at all
/// times (`emergency.tsx:106-110`) so the fastest action on the screen
/// is always one tap away.
struct EmergencyCall911Banner: View {
    let onCall: () -> Void

    var body: some View {
        Button(action: onCall) {
            HStack(spacing: Spacing.s2) {
                Icon(.phoneCall, size: 18, strokeWidth: 2, color: Theme.Color.appTextInverse)
                Text(EmergencyInfoViewModel.emergencyBannerTitle)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.s3)
            .background(Theme.Color.error)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Emergency. Call 911")
        .accessibilityIdentifier("emergencyCall911Banner")
    }
}

private struct ShareTextItem: Identifiable {
    let id = UUID()
    let text: String
}

private struct CardPDFItem: Identifiable {
    let id = UUID()
    let url: URL
}

#Preview {
    NavigationStack {
        EmergencyInfoView(viewModel: EmergencyInfoViewModel(homeId: "preview"))
    }
}
