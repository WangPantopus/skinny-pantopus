//
//  CrewDayProposeDatesView.swift
//  Pantopus
//
//  18. Propose new dates (build kit 01-spec.md, board `ProposeDates`):
//  "Rain? Offer 2 or 3 dates." Day chips for the next 14 days with an
//  arrival window each, the message each household gets, "Goes to 6 homes.
//  Your Tuesday visit is called off for everyone when you send.", then
//  Send to 6 homes (`POST /api/crew-days/:id/propose-dates`).
//

import SwiftUI

@Observable
@MainActor
final class CrewDayProposeDatesModel {
    let crewDayId: String
    private(set) var page: CrewDayLoad<CrewDayCrewPageDTO> = .loading
    /// Picked dates (`YYYY-MM-DD`) and each one's window.
    private(set) var picked: [String] = []
    var windows: [String: CrewDayProposeDatesModel.Window] = [:]
    private(set) var sending = false
    var error: String?

    struct Window: Hashable, Identifiable {
        let start: String
        let end: String

        var id: String {
            start
        }

        static let choices = [
            Window(start: "08:00", end: "12:00"),
            Window(start: "09:00", end: "13:00"),
            Window(start: "10:00", end: "14:00"),
            Window(start: "12:00", end: "16:00"),
            Window(start: "13:00", end: "17:00")
        ]
    }

    init(crewDayId: String) {
        self.crewDayId = crewDayId
    }

    var day: CrewDayCrewPageDTO? {
        page.value
    }

    /// The homes the proposal goes to: every one still booked.
    var homes: Int {
        day?.bookings.filter { ["booked", "new_dates"].contains($0.status) }.count ?? 0
    }

    /// The next 14 days from tomorrow, in the day's own time zone.
    var days: [String] {
        let tz = day?.day.card.timezone
        let calendar = CrewDayFormat.calendar(tz)
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return (1...14).compactMap { calendar.date(byAdding: .day, value: $0, to: Date()) }.map { formatter.string(from: $0) }
    }

    var canSend: Bool {
        (2...3).contains(picked.count) && homes > 0 && !sending
    }

    func load() async {
        do {
            let page: CrewDayCrewPageDTO = try await APIClient.shared.request(CrewDayEndpoints.crewDay(crewDayId: crewDayId))
            self.page = .loaded(page)
        } catch {
            if page.value == nil { page = .failed(CrewDayErrors.sentence(for: error)) }
        }
    }

    func toggle(_ date: String) {
        if let index = picked.firstIndex(of: date) {
            picked.remove(at: index)
            windows[date] = nil
        } else if picked.count < 3 {
            picked.append(date)
            picked.sort()
            let card = day?.day.card
            windows[date] = Window(start: card?.windowStart ?? "09:00", end: card?.windowEnd ?? "13:00")
        }
    }

    func send() async -> Bool {
        guard canSend else { return false }
        sending = true
        error = nil
        defer { sending = false }
        let dates = picked.map { date in
            let window = windows[date] ?? Window(start: "09:00", end: "13:00")
            return CrewDayDateWindow(date: date, windowStart: window.start, windowEnd: window.end)
        }
        do {
            _ = try await APIClient.shared.request(
                CrewDayEndpoints.proposeDates(crewDayId: crewDayId, CrewDayProposeDatesBody(dates: dates, note: nil)),
                as: CrewDayCrewPageWriteResponse.self
            )
            NotificationCenter.default.post(name: .crewDayChanged, object: nil)
            return true
        } catch {
            self.error = CrewDayErrors.sentence(for: error)
            return false
        }
    }
}

struct CrewDayProposeDatesView: View {
    @State var model: CrewDayProposeDatesModel
    let onBack: () -> Void
    let onSent: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            PlanNavBar(title: "Propose new dates", onLeading: onBack)
            switch model.page {
            case .loading:
                CrewDayLoadingView()
            case let .failed(message):
                CrewDayErrorView(message: message) { await model.load() }
            case .loaded:
                form
            }
        }
        .background(Theme.Color.appBg)
        .task { await model.load() }
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayProposeDates")
    }

    private var form: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s5) {
                    Text("Rain? Offer 2 or 3 dates. Each household picks one or cancels at no charge. Nobody is moved without saying yes.")
                        .planFont(.body)
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .fixedSize(horizontal: false, vertical: true)
                    dayGrid
                    if !model.picked.isEmpty { windowRows }
                    if model.picked.count >= 2 { preview }
                    warning
                    if let error = model.error { CrewDayErrorText(text: error, identifier: "crewDayProposeDatesError") }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.vertical, Spacing.s2)
            }
            CrewDayFooter {
                Button { Task { if await model.send() { onSent() } } } label: {
                    PlanButtonLabel(title: "Send to \(CrewDayFormat.homes(model.homes))", isLoading: model.sending)
                }
                .planButton(.primary)
                .disabled(!model.canSend)
                .accessibilityIdentifier("crewDayProposeDatesSend")
            }
        }
    }

    private var dayGrid: some View {
        let tz = model.day?.day.card.timezone
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .firstTextBaseline) {
                Text.planOverline("Next 14 days")
                Spacer()
                Text("\(model.picked.count) of 3 picked")
                    .planFont(.footnote)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityIdentifier("crewDayProposeDatesCount")
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 7), spacing: 6) {
                ForEach(model.days, id: \.self) { date in
                    let on = model.picked.contains(date)
                    let day = CrewDayFormat.day(date, timezone: tz)
                    Button { model.toggle(date) } label: {
                        VStack(spacing: 2) {
                            Text(dayPart(day, "EEE", tz)).planFont(.chip)
                                .foregroundStyle(on ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary)
                            Text(dayPart(day, "d", tz))
                                .planFont(.bodyStrong)
                                .monospacedDigit()
                                .foregroundStyle(on ? Theme.Color.appTextInverse : Theme.Color.appText)
                        }
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .background(RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(on ? Theme.Color.primarySolid : Theme.Color.appSurface))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(
                            on ? Theme.Color.primarySolid : Theme.Color.appBorder,
                            lineWidth: 1
                        ))
                    }
                    .buttonStyle(.plain)
                    .disabled(!on && model.picked.count >= 3)
                    .accessibilityLabel(CrewDayFormat.longDay(date, timezone: tz))
                    .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
                    .accessibilityIdentifier("crewDayProposeDatesDate_\(date)")
                }
            }
        }
    }

    private func dayPart(_ date: Date?, _ pattern: String, _ tz: String?) -> String {
        guard let date else { return "" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = CrewDayFormat.calendar(tz).timeZone
        formatter.dateFormat = pattern
        return formatter.string(from: date)
    }

    private var windowRows: some View {
        let tz = model.day?.day.card.timezone
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("Arrival windows")
            CrewDayCard(padding: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(model.picked.enumerated()), id: \.element) { index, date in
                        if index > 0 { Divider().overlay(Theme.Color.appBorder) }
                        HStack(spacing: Spacing.s3) {
                            Text(CrewDayFormat.shortDay(date, timezone: tz)).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                            Spacer()
                            Picker("Arrival window", selection: Binding(
                                get: { model.windows[date] ?? CrewDayProposeDatesModel.Window.choices[1] },
                                set: { model.windows[date] = $0 }
                            )) {
                                ForEach(CrewDayProposeDatesModel.Window.choices) { window in
                                    Text(CrewDayFormat.window(window.start, window.end)).tag(window)
                                }
                            }
                            .pickerStyle(.menu)
                            .accessibilityIdentifier("crewDayProposeDatesWindow_\(date)")
                        }
                        .padding(.horizontal, 14)
                        .frame(minHeight: 56)
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("crewDayProposeDatesWindows")
        }
    }

    /// "Example Gutter Co. can come Thu, Nov 19 or Sat, Nov 21 at the same price. …"
    private var preview: some View {
        let tz = model.day?.day.card.timezone
        let names = model.picked.map { CrewDayFormat.shortDay($0, timezone: tz) }
        let list = names.count > 2 ? names.dropLast().joined(separator: ", ") + " or " + (names.last ?? "") : names
            .joined(separator: " or ")
        let crew = model.day?.crew?.name ?? "Your crew"
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            Text.planOverline("What each household gets")
            CrewDayCard {
                HStack(alignment: .top, spacing: Spacing.s3) {
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .fill(Theme.Color.warningLight)
                        .frame(width: 34, height: 34)
                        .overlay(Icon(.cloudRain, size: 18, color: Theme.Color.warningDeep))
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Rain changed the plan").planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                        Text(
                            "\(crew) can come \(list) at the same price. No payment has been taken. "
                                + "If you don't answer in time, we won't book a new date."
                        )
                        .planFont(.small)
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .accessibilityIdentifier("crewDayProposeDatesPreview")
        }
    }

    private var warning: some View {
        let tz = model.day?.day.card.timezone
        let weekday = CrewDayFormat.weekday(model.day?.day.card.serviceDate, timezone: tz)
        return HStack(alignment: .top, spacing: 10) {
            Icon(.triangleAlert, size: 16, color: Theme.Color.warningDeep).padding(.top, 2)
            Text("Goes to \(CrewDayFormat.homes(model.homes)). Your \(weekday) visit is called off for everyone when you send.")
                .planFont(.small)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, Spacing.s3)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.Color.warningBg))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.Color.warningLight, lineWidth: 1))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("crewDayProposeDatesWarning")
    }
}
