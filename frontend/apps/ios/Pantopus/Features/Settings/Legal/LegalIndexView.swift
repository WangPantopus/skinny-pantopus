//
//  LegalIndexView.swift
//  Pantopus
//
//  P8 / T6.2c — Settings → Legal sub-route. GroupedList TOC linking
//  to long-form documents. The documents themselves render via
//  `LegalContentView`. Per Q7: Terms / Privacy / AUP for now.
//

import Observation
import SwiftUI

public enum LegalDocument: String, CaseIterable, Sendable, Hashable, Identifiable {
    case terms, privacy, acceptableUse, cookies, openSource

    public var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .terms: "Terms of service"
        case .privacy: "Privacy policy"
        case .acceptableUse: "Acceptable use"
        case .cookies: "Cookies"
        case .openSource: "Open-source licenses"
        }
    }

    var subtitle: String {
        switch self {
        case .terms: "What you agree to by using Pantopus"
        case .privacy: "What we collect and why"
        case .acceptableUse: "What's not allowed on the platform"
        case .cookies: "Browser storage and tracking"
        case .openSource: "Libraries Pantopus is built on"
        }
    }
}

@Observable
@MainActor
public final class LegalIndexViewModel: GroupedListDataSource {
    public var title: String {
        "Legal"
    }

    public var footerCaption: String? {
        "All documents are kept in plain language. Reach out via Help if anything's unclear."
    }

    public private(set) var state: GroupedListState = .loading

    private let onSelect: @MainActor (LegalDocument) -> Void

    public init(onSelect: @escaping @MainActor (LegalDocument) -> Void) {
        self.onSelect = onSelect
    }

    public func load() async {
        state = .loaded([
            GroupedListGroup(
                id: "policies",
                overline: "Policies",
                rows: [
                    row(.terms), row(.privacy), row(.acceptableUse), row(.cookies)
                ]
            ),
            GroupedListGroup(
                id: "credits",
                overline: "Credits",
                rows: [row(.openSource)]
            )
        ])
    }

    public func tapRow(_ rowId: String) async {
        if let doc = LegalDocument.allCases.first(where: { $0.rawValue == rowId }) {
            onSelect(doc)
        }
    }

    public func toggleRow(_: String, isOn _: Bool) async {}
    public func selectRadio(_: String) async {}
    public func setSlider(_: String, index _: Int) async {}

    private func row(_ doc: LegalDocument) -> GroupedListRow {
        GroupedListRow(
            id: doc.rawValue,
            label: doc.title,
            subtext: doc.subtitle,
            control: .chevron
        )
    }
}

public struct LegalIndexView: View {
    @State private var viewModel: LegalIndexViewModel
    private let onBack: @MainActor () -> Void

    public init(
        onBack: @escaping @MainActor () -> Void,
        onSelect: @escaping @MainActor (LegalDocument) -> Void
    ) {
        _viewModel = State(initialValue: LegalIndexViewModel(onSelect: onSelect))
        self.onBack = onBack
    }

    public var body: some View {
        GroupedListView(dataSource: viewModel, onBack: onBack)
            .accessibilityIdentifier("legalIndex")
    }
}

#Preview {
    NavigationStack {
        LegalIndexView(onBack: {}, onSelect: { _ in })
    }
}
