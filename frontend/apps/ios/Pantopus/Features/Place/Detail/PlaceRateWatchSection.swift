//
//  PlaceRateWatchSection.swift
//  Pantopus
//
//  Wave 2b — the rate watch, extracted from PlaceMoneyDetailContent
//  (which had outgrown the 500-line file budget). One user-entered
//  fact (the month the loan was recorded) held against Freddie Mac's
//  weekly PMMS average. Averages and deltas only — never advice.
//

import SwiftUI

// swiftlint:disable line_length

// MARK: - Rate watch VM (Wave 2b)
// One user-entered fact (the month the loan was recorded) held against
// Freddie Mac's weekly PMMS average. Averages and deltas only — the
// copy never says "refinance". Watches are personal per home+user.

@Observable
@MainActor
final class PlaceRateWatchViewModel {
    enum State {
        case loading
        case none
        case loaded(RecordWatch)
        case error(message: String)
    }

    private(set) var state: State = .loading
    private(set) var isSaving = false
    /// Save failures stay INLINE — never collapse the form to .error.
    private(set) var saveError: String?
    var monthInput = ""
    let homeId: String
    private let api: APIClient

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    func load() async {
        do {
            let response: RecordWatchResponse = try await api.request(
                RecordWatchEndpoints.get(homeId: homeId)
            )
            state = response.watch.map(State.loaded) ?? .none
        } catch let error as APIError {
            state = .error(message: error.errorDescription ?? "Couldn't load your watch.")
        } catch {
            state = .error(message: "Couldn't load your watch.")
        }
    }

    func save() async {
        let month = monthInput.trimmingCharacters(in: .whitespaces)
        guard !month.isEmpty else { return }
        isSaving = true
        saveError = nil
        defer { isSaving = false }
        // A rejected save (typo month, out-of-range, transient 500) keeps
        // the current state — the form, with the typed month still in it —
        // and reports inline. Replacing the whole section with a dead-end
        // error card turned a one-character typo into an apparent outage.
        do {
            let response: RecordWatchResponse = try await api.request(
                RecordWatchEndpoints.set(homeId: homeId, request: SetRecordWatchRequest(loanRecordedMonth: month))
            )
            monthInput = ""
            state = response.watch.map(State.loaded) ?? .none
        } catch let error as APIError {
            saveError = error.errorDescription ?? "Couldn't save the watch."
        } catch {
            saveError = "Couldn't save the watch."
        }
    }

    func remove() async {
        saveError = nil
        do {
            _ = try await api.request(RecordWatchEndpoints.delete(homeId: homeId)) as EmptyResponse
            state = .none
        } catch let error as APIError {
            // A silent failed removal tells the resident their watch is
            // gone when it is still running — they will keep getting
            // alerts they believe they turned off.
            saveError = error.errorDescription ?? "Couldn't remove the watch."
            await load()
        } catch {
            saveError = "Couldn't remove the watch."
            await load()
        }
    }
}

// MARK: - Rate watch section (Wave 2b)

struct RateWatchSection: View {
    let vm: PlaceRateWatchViewModel

    var body: some View {
        switch vm.state {
        case .loading:
            PlaceDetailCard {
                Text("Loading your watch…")
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        case let .error(message):
            PlaceDetailCard {
                VStack(alignment: .leading, spacing: 8) {
                    Text(message)
                        .font(.system(size: 13.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                    Button("Try again") {
                        Task { await vm.load() }
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary600)
                    .buttonStyle(.plain)
                }
            }
        case .none:
            RateWatchForm(vm: vm)
        case let .loaded(watch):
            RateWatchCard(watch: watch, vm: vm)
        }
    }
}

struct RateWatchForm: View {
    @Bindable var vm: PlaceRateWatchViewModel

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Watch rates against your loan")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Hear it from your dashboard before the refi mailers find you. Enter the month your loan was recorded (YYYY-MM).")
                    .font(.system(size: 12.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                TextField("2023-03", text: $vm.monthInput)
                    .keyboardType(.numbersAndPunctuation)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(size: 15))
                if let saveError = vm.saveError {
                    Text(saveError)
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.error)
                }
                Button {
                    Task { await vm.save() }
                } label: {
                    Text(vm.isSaving ? "Saving…" : "Start watching")
                        .font(.system(size: 14.5, weight: .semibold))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(vm.isSaving || vm.monthInput.trimmingCharacters(in: .whitespaces).isEmpty)
                Text("We compare Freddie Mac's weekly 30-year survey average with the average for your month — facts about the market, not refinancing advice. Only you can see this.")
                    .font(.system(size: 11.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
        }
    }
}

struct RateWatchCard: View {
    let watch: RecordWatch
    let vm: PlaceRateWatchViewModel

    private var monthLabel: String {
        PlacePresentation.fmtYearMonth(watch.loanRecordedMonth) ?? watch.loanRecordedMonth
    }

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Text("Rate watch")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: 0)
                    if let ev = watch.evaluation {
                        PlaceChip(model: deltaChip(ev))
                    }
                }
                Text("Watching against \(monthLabel), when your loan was recorded")
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.Color.appTextMuted)
                HStack(spacing: 20) {
                    rateColumn(label: "\(monthLabel) average", rate: watch.baselineRate)
                    rateColumn(label: "This week", rate: watch.evaluation?.currentRate)
                }
                Text(caption)
                    .font(.system(size: 12.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextMuted)
                if let saveError = vm.saveError {
                    Text(saveError)
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.error)
                }
                Button(role: .destructive) {
                    Task { await vm.remove() }
                } label: {
                    Text("Remove watch")
                        .font(.system(size: 13.5, weight: .semibold))
                }
            }
        }
    }

    private var caption: String {
        if watch.evaluation?.refiWindow == true {
            return "The market average is meaningfully below your loan month's average — the comparison lenders start from. We'll nudge you when it moves further."
        }
        return "We check the weekly market average against your month and nudge you if it falls meaningfully below — before the mail offers do."
    }

    private func deltaChip(_ ev: RecordWatchEvaluation) -> PlaceChipModel {
        if ev.refiWindow {
            return PlaceChipModel(tone: .success, text: String(format: "%.2fpp below your month", abs(ev.deltaPp)), icon: .trendingDown)
        }
        let sign = ev.deltaPp > 0 ? "+" : ""
        return PlaceChipModel(tone: .neutral, text: String(format: "%@%.2fpp vs your month", sign, ev.deltaPp))
    }

    private func rateColumn(label: String, rate: Double?) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextMuted)
            Text(rate.map { String(format: "%.2f%%", $0) } ?? "—")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
        }
    }
}
