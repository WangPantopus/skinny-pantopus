//
//  AddHouseholdTaskFormViewModel+Helpers.swift
//  Pantopus
//

import Foundation

extension AddHouseholdTaskFormViewModel {
    // MARK: - Hydration

    func hydrate(from task: HomeTaskDTO) {
        seed(.title, task.title)
        seed(.notes, task.description ?? "")
        seed(.assignedTo, task.assignedTo ?? "")
        seed(.dueAt, Self.isoDayOnly(from: task.dueAt) ?? "")
        let category = AddHouseholdTaskFormCategory.from(
            taskType: task.taskType,
            title: task.title
        )
        seed(.category, category.rawValue)
        let parsed = Self.parseRecurrence(task.recurrenceRule)
        seed(.recurrence, parsed.recurrence.rawValue)
        seed(.customInterval, "\(parsed.interval)")
        seed(.customUnit, parsed.unit.rawValue)
        primeErrors()
    }

    func defaultValue(for field: AddHouseholdTaskField) -> String {
        switch field {
        case .category: AddHouseholdTaskFormCategory.other.rawValue
        case .recurrence: AddHouseholdTaskRecurrence.oneTime.rawValue
        case .customInterval: "1"
        case .customUnit: AddHouseholdTaskCustomUnit.weeks.rawValue
        default: ""
        }
    }

    func seed(_ field: AddHouseholdTaskField, _ value: String) {
        var snapshot = FormFieldState(id: field.rawValue, originalValue: value)
        snapshot.error = validator(for: field).validate(value)
        fields[field] = snapshot
    }

    /// Re-run every validator against the current values without
    /// flipping touched flags — used after a seed so the aggregate
    /// reflects the initial pose.
    func primeErrors() {
        for field in AddHouseholdTaskField.allCases {
            guard var snapshot = fields[field] else { continue }
            snapshot.error = validator(for: field).validate(snapshot.value)
            fields[field] = snapshot
        }
    }

    // MARK: - Validators

    func validator(for field: AddHouseholdTaskField) -> FormValidator {
        switch field {
        case .title:
            .all([.required("Title"), .maxLength(80)])
        case .recurrence:
            FormValidator { value in
                AddHouseholdTaskRecurrence(rawValue: value) == nil
                    ? "Pick a recurrence."
                    : nil
            }
        case .category:
            FormValidator { value in
                AddHouseholdTaskFormCategory(rawValue: value) == nil
                    ? "Pick a category."
                    : nil
            }
        case .customInterval:
            // Only enforced when the parent picker is .custom — we
            // pass the live recurrence + unit as `Sendable` value
            // snapshots so the validator closure stays
            // `@Sendable`-safe under strict concurrency.
            Self.customIntervalValidator(
                recurrence: selectedRecurrence,
                unit: selectedCustomUnit
            )
        case .customUnit:
            FormValidator { value in
                AddHouseholdTaskCustomUnit(rawValue: value) == nil
                    ? "Pick a unit."
                    : nil
            }
        default:
            FormValidator { _ in nil }
        }
    }

    /// Build a custom-interval validator parameterised on a snapshot
    /// of the current recurrence + unit. Keeping the closure `Sendable`
    /// — i.e. free of `self` capture — requires we pass these as value
    /// arguments rather than reading them inside the closure body.
    static func customIntervalValidator(
        recurrence: AddHouseholdTaskRecurrence,
        unit: AddHouseholdTaskCustomUnit
    ) -> FormValidator {
        let unitLabel = unit.label.lowercased()
        return FormValidator { value in
            guard recurrence == .custom else { return nil }
            guard let n = Int(value.trimmingCharacters(in: .whitespaces)) else {
                return "Enter a whole number of \(unitLabel)."
            }
            if n < 1 { return "Must be at least 1." }
            if n > 365 { return "Must be 365 or fewer." }
            return nil
        }
    }
}

extension AddHouseholdTaskFormViewModel {
    // MARK: - Wire payload

    func buildCreateRequest() -> CreateHomeTaskRequest {
        let snapshot = wireSnapshot()
        return CreateHomeTaskRequest(
            taskType: snapshot.taskType,
            title: snapshot.title,
            description: snapshot.description,
            assignedTo: snapshot.assignedTo,
            dueAt: snapshot.dueAt,
            recurrenceRule: snapshot.recurrenceRule,
            priority: nil
        )
    }

    func buildUpdateRequest() -> UpdateHomeTaskRequest {
        let snapshot = wireSnapshot()
        // Edit mode sends every field on the wire — the form's job
        // is to keep the row's authoritative pose in lockstep with
        // the user's edits. `nil` is reserved for fields the schema
        // doesn't support yet.
        return UpdateHomeTaskRequest(
            status: nil,
            title: snapshot.title,
            description: snapshot.description,
            assignedTo: snapshot.assignedTo,
            dueAt: snapshot.dueAt,
            // See top-of-file note: backend allowlist drops
            // recurrence_rule today. We still send it so the wire
            // tracks user intent.
            recurrenceRule: snapshot.recurrenceRule,
            priority: nil,
            completedAt: nil
        )
    }

    private struct WireSnapshot {
        let taskType: String
        let title: String
        let description: String?
        let assignedTo: String?
        let dueAt: String?
        let recurrenceRule: String?
    }

    private func wireSnapshot() -> WireSnapshot {
        let title = (fields[.title]?.value ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let notes = (fields[.notes]?.value ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let assignee = (fields[.assignedTo]?.value ?? "")
            .trimmingCharacters(in: .whitespaces)
        let due = (fields[.dueAt]?.value ?? "")
            .trimmingCharacters(in: .whitespaces)
        return WireSnapshot(
            taskType: selectedCategory.taskType,
            title: title,
            description: notes.isEmpty ? nil : notes,
            assignedTo: assignee.isEmpty ? nil : assignee,
            dueAt: due.isEmpty ? nil : due,
            recurrenceRule: buildRecurrenceRule()
        )
    }

    private func buildRecurrenceRule() -> String? {
        switch selectedRecurrence {
        case .oneTime: return nil
        case .daily: return "FREQ=DAILY"
        case .weekly: return "FREQ=WEEKLY"
        case .monthly: return "FREQ=MONTHLY"
        case .custom:
            let interval = max(1, Int(fields[.customInterval]?.value ?? "") ?? 1)
            return "FREQ=\(selectedCustomUnit.rruleFreq);INTERVAL=\(interval)"
        }
    }
}

extension AddHouseholdTaskFormViewModel {
    // MARK: - Parsing

    struct ParsedRecurrence {
        let recurrence: AddHouseholdTaskRecurrence
        let interval: Int
        let unit: AddHouseholdTaskCustomUnit
    }

    /// Map a server `recurrence_rule` to the form's picker selections.
    /// Anything with an `INTERVAL=` larger than 1 lands on `.custom`
    /// so the round-trip is editable; vanilla `FREQ=...` rules land on
    /// the matching simple option.
    static func parseRecurrence(_ rule: String?) -> ParsedRecurrence {
        let raw = rule?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        guard !raw.isEmpty else {
            return ParsedRecurrence(recurrence: .oneTime, interval: 1, unit: .weeks)
        }
        let interval = parseInterval(raw)
        let unit: AddHouseholdTaskCustomUnit
        let baseRecurrence: AddHouseholdTaskRecurrence
        switch true {
        case raw.contains("freq=daily"):
            baseRecurrence = .daily
            unit = .days
        case raw.contains("freq=weekly"):
            baseRecurrence = .weekly
            unit = .weeks
        case raw.contains("freq=monthly"):
            baseRecurrence = .monthly
            unit = .months
        default:
            return ParsedRecurrence(recurrence: .custom, interval: 1, unit: .weeks)
        }
        if interval <= 1 {
            return ParsedRecurrence(recurrence: baseRecurrence, interval: 1, unit: unit)
        }
        return ParsedRecurrence(recurrence: .custom, interval: interval, unit: unit)
    }

    private static func parseInterval(_ lowered: String) -> Int {
        guard let range = lowered.range(of: "interval=") else { return 1 }
        let tail = lowered[range.upperBound...]
        let token = tail.split(separator: ";", maxSplits: 1).first.map(String.init)
            ?? String(tail)
        return Int(token.trimmingCharacters(in: .whitespaces)) ?? 1
    }

    private static func isoDayOnly(from iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        // Backend can return either `yyyy-MM-dd` or a full ISO
        // timestamp. The form only edits the day; strip the time.
        if let dash = iso.firstIndex(of: "T") {
            return String(iso[..<dash])
        }
        return iso.prefix(10).isEmpty ? nil : String(iso.prefix(10))
    }

    static func parseISODay(_ value: String) -> Date? {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        return makeDayFormatter().date(from: trimmed)
    }

    static func formatISODay(_ date: Date) -> String {
        makeDayFormatter().string(from: date)
    }

    private static func makeDayFormatter() -> DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }
}
