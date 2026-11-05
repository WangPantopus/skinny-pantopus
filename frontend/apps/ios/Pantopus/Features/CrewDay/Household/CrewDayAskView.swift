//
//  CrewDayAskView.swift
//  Pantopus
//
//  11. Ask for a Crew Day on your street (build kit 01-spec.md, board
//  `AskStreet`): the service, the street from your home, the months that
//  suit you (or any time) and anything else, then Send request
//  (`POST /api/crew-days/requests`). Needs a home in Pantopus; without one,
//  "Add your home first" opens the existing home setup.
//

import SwiftUI

@Observable
@MainActor
final class CrewDayAskModel {
    private(set) var homes: CrewDayLoad<[CrewDayHomeAddress]> = .loading
    var service: String?
    var months: Set<String> = []
    var note = ""
    private(set) var sending = false
    private(set) var sent: CrewDayCardDTO?
    var error: String?

    static let noteLimit = 500

    /// The next six months ("2026-11" …), in the order they come.
    let monthOptions: [(key: String, label: String)] = {
        let calendar = CrewDayFormat.calendar(nil)
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        return (0..<6).compactMap { offset in
            guard let date = calendar.date(byAdding: .month, value: offset, to: Date()) else { return nil }
            formatter.dateFormat = "yyyy-MM"
            let key = formatter.string(from: date)
            formatter.dateFormat = "MMM"
            return (key, formatter.string(from: date))
        }
    }()

    var home: CrewDayHomeAddress? {
        homes.value?.first
    }

    var canSend: Bool {
        home?.homeId != nil && service != nil && !months.isEmpty && !sending
    }

    func load() async {
        do {
            let response: MyHomesResponse = try await APIClient.shared.request(HomesEndpoints.myHomes())
            let usable = response.homes.compactMap { mine -> CrewDayHomeAddress? in
                guard let line = mine.home.address, !line.isEmpty else { return nil }
                return CrewDayHomeAddress(
                    line: line,
                    city: mine.home.city ?? "",
                    state: mine.home.state ?? "",
                    zip: mine.home.zipcode ?? "",
                    latitude: mine.location?.latitude ?? 0,
                    longitude: mine.location?.longitude ?? 0,
                    homeId: mine.home.id
                )
            }
            // The default home first: the request is for its street.
            let preferred = response.defaultHomeId.flatMap { id in usable.first { $0.homeId == id } }
            let others = usable.filter { $0 != preferred }
            homes = .loaded(preferred.map { [$0] + others } ?? usable)
        } catch {
            homes = .failed(CrewDayErrors.sentence(for: error))
        }
    }

    func toggleMonth(_ key: String) {
        if key == "any" {
            months = months.contains("any") ? [] : ["any"]
            return
        }
        months.remove("any")
        if months.contains(key) { months.remove(key) } else { months.insert(key) }
    }

    func send() async {
        guard canSend, let service, let homeId = home?.homeId else { return }
        sending = true
        error = nil
        defer { sending = false }
        let ordered = months.contains("any") ? ["any"] : monthOptions.map(\.key).filter { months.contains($0) }
        let text = note.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            let response: CrewDayRequestResponse = try await APIClient.shared.request(
                CrewDayEndpoints.ask(CrewDayRequestBody(service: service, homeId: homeId, months: ordered, note: text.isEmpty ? nil : text))
            )
            sent = response.request
            NotificationCenter.default.post(name: .crewDayChanged, object: nil)
        } catch {
            self.error = CrewDayErrors.sentence(for: error)
        }
    }

    /// "Maple Lane, Camas": the street without the house number.
    static func street(_ home: CrewDayHomeAddress) -> String {
        let street = home.line.replacingOccurrences(of: "^[0-9]+[A-Za-z]?\\s+", with: "", options: .regularExpression)
        return [street, home.city].filter { !$0.isEmpty }.joined(separator: ", ")
    }
}

/// `{ request }` from `POST /api/crew-days/requests`.
struct CrewDayRequestResponse: Decodable {
    let request: CrewDayCardDTO
}

struct CrewDayAskView: View {
    @State var model: CrewDayAskModel
    let onBack: () -> Void
    let onAddHome: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar(title: "Ask for a Crew Day", onLeading: onBack)
            if model.sent != nil {
                sent
            } else {
                switch model.homes {
                case .loading:
                    CrewDayLoadingView()
                case let .failed(message):
                    CrewDayErrorView(message: message) { await model.load() }
                case .loaded:
                    form
                }
            }
        }
        .background(Theme.Color.appBg)
        .task { await model.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayAsk")
    }

    private var form: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    Text("Tell us what your street needs. We'll look for a local crew. Nothing is booked until you see a price.")
                        .planFont(.body)
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .fixedSize(horizontal: false, vertical: true)
                    group("Service") {
                        PlanFlowLayout(spacing: Spacing.s2) {
                            ForEach(CrewDayService.allCases, id: \.rawValue) { service in
                                chip(
                                    service.label,
                                    selected: model.service == service.rawValue,
                                    id: "crewDayAskService_\(service.rawValue)"
                                ) {
                                    model.service = service.rawValue
                                }
                            }
                        }
                    }
                    group("Your street") { street }
                    group("When suits you") {
                        PlanFlowLayout(spacing: Spacing.s2) {
                            ForEach(model.monthOptions, id: \.key) { month in
                                chip(month.label, selected: model.months.contains(month.key), id: "crewDayAskMonth_\(month.key)") {
                                    model.toggleMonth(month.key)
                                }
                            }
                            chip("Any time", selected: model.months.contains("any"), id: "crewDayAskMonth_any") { model.toggleMonth("any") }
                        }
                    }
                    noteField
                    if let error = model.error { CrewDayErrorText(text: error, identifier: "crewDayAskError") }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s2)
            }
            .scrollDismissesKeyboard(.interactively)
            CrewDayFooter {
                Button { Task { await model.send() } } label: {
                    PlanButtonLabel(title: "Send request", isLoading: model.sending)
                }
                .planButton(.primary)
                .disabled(!model.canSend)
                .accessibilityIdentifier("crewDayAskSend")
                Text("We'll tell you within a week whether a crew can come.")
                    .planFont(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    @ViewBuilder private var street: some View {
        if let home = model.home {
            CrewDayCard {
                HStack(spacing: Spacing.s3) {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Theme.Color.homeBg)
                        .frame(width: 40, height: 40)
                        .overlay(Icon(.house, size: 20, color: Theme.Color.home))
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(CrewDayAskModel.street(home)).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                        Text("From your home").planFont(.footnote).fontWeight(.semibold).foregroundStyle(Theme.Color.home)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("crewDayAskStreet")
                Divider().overlay(Theme.Color.appBorder)
                CrewDayLockLine(text: "Neighbors see the street and the service, never who asked.")
            }
        } else {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Add your home first").planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                    Text("We ask crews for the street your home is on.")
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Button("Add your home", action: onAddHome)
                    .planButton(.primary, size: .small)
                    .accessibilityIdentifier("crewDayAskAddHome")
            }
            .padding(Spacing.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).fill(Theme.Color.warningBg))
            .overlay(RoundedRectangle(cornerRadius: Radii.xl2, style: .continuous).stroke(Theme.Color.warningLight, lineWidth: 1))
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("crewDayAskNoHome")
        }
    }

    private var noteField: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("Anything else? (optional)")
            TextField("Front and back yards, a big maple, a steep driveway", text: $model.note, axis: .vertical)
                .planFont(.body)
                .lineLimit(3...8)
                .padding(.horizontal, 14)
                .padding(.vertical, Spacing.s3)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.Color.appSurface))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.Color.appBorderStrong, lineWidth: 1))
                .onChange(of: model.note) { _, text in
                    if text.count > CrewDayAskModel.noteLimit { model.note = String(text.prefix(CrewDayAskModel.noteLimit)) }
                }
                .accessibilityLabel("Anything else?")
                .accessibilityIdentifier("crewDayAskNote")
            Text("\(model.note.count) / 500")
                .planFont(.caption)
                .monospacedDigit()
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    private var sent: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Theme.Color.home)
                .frame(width: 56, height: 56)
                .overlay(Icon(.check, size: 28, strokeWidth: 3, color: Theme.Color.appTextInverse))
                .accessibilityHidden(true)
            Text("Request sent")
                .planFont(.h2)
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text("We'll tell you within a week whether a crew can come. It's under Asked for in Your Crew Days.")
                .planFont(.body)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            Button("Done", action: onBack)
                .planButton(.primary)
                .accessibilityIdentifier("crewDayAskDone")
            Spacer()
        }
        .padding(Spacing.s5)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayAskSent")
    }

    private func group(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline(title)
            content()
        }
    }

    private func chip(_ label: String, selected: Bool, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if selected { Icon(.check, size: 16, strokeWidth: 2.6, color: Theme.Color.primary700) }
                Text(label)
                    .planFont(selected ? .bodyStrong : .body)
                    .foregroundStyle(selected ? Theme.Color.primary700 : Theme.Color.appText)
                    .lineLimit(1)
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 44)
            .background(Capsule().fill(selected ? Theme.Color.primary50 : Theme.Color.appSurface))
            .overlay(Capsule().stroke(selected ? Theme.Color.primary700 : Theme.Color.appBorderStrong, lineWidth: selected ? 1.5 : 1))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier(id)
    }
}
