//
//  EditAccessCodeFormViewModel+Roster.swift
//  Pantopus
//
//  The "Shared with" picker's roster summaries, kept apart from the form's
//  load / validate / save / delete flow.
//

import Foundation

extension EditAccessCodeFormViewModel {
    /// Household-roster summary string used by the visibility picker
    /// ("All 4 members"). Empty until the roster loads.
    func rosterSummary(for scope: AccessVisibility) -> String {
        let count = roster.count
        switch scope {
        case .everyone:
            return count == 0 ? scope.headline : "Everyone (\(count) members + guests)"
        case .members:
            return count == 0 ? scope.headline : "All household members (\(count))"
        case .managers:
            let managers = roster.filter(\.canManageAccess)
            return managers.isEmpty
                ? scope.headline
                : "Owners & managers (\(managers.count))"
        case .sensitive:
            let owners = roster.filter { $0.role?.lowercased() == "owner" }
            return owners.isEmpty
                ? scope.headline
                : "Owners only (\(owners.count))"
        }
    }

    /// Names of members the selected visibility scope grants access to.
    /// Drives the "Shared with" preview strip — keeps the picker visibly
    /// tied to the actual roster rather than abstract scope labels.
    func sharedWithNames() -> [String] {
        switch visibility {
        case .everyone, .members:
            roster.map(\.displayName)
        case .managers:
            roster.filter(\.canManageAccess).map(\.displayName)
        case .sensitive:
            roster.filter { $0.role?.lowercased() == "owner" }.map(\.displayName)
        }
    }
}
