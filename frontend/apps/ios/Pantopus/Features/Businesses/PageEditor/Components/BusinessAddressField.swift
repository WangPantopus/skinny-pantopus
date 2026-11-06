//
//  BusinessAddressField.swift
//  Pantopus
//
//  The Location section's Address field with address suggestions under
//  it. A picked suggestion fills the address, city, state and ZIP through
//  the editor's usual field changes. Parity: Android
//  `EditBusinessPageScreen` Location section.
//

import SwiftUI

struct BusinessAddressField: View {
    let field: EditBusinessPageField
    let state: BizFieldState
    let onFieldChange: @MainActor (EditBusinessPageFieldKey, String) -> Void
    @State private var suggestions = AddressSuggestions()

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            BizField(
                label: "Address",
                required: true,
                field: field,
                state: state,
                trailing: .mapPin,
                identifier: "editBusinessPage.field.address"
            ) { value in
                onFieldChange(.address, value)
                suggestions.textChanged(value)
            }
            AddressSuggestionList(suggestions: suggestions, identifier: "editBusinessPage.addressSuggestion") { suggestion in
                Task {
                    guard let picked = await suggestions.choose(suggestion) else { return }
                    if let street = picked.address, !street.isEmpty { onFieldChange(.address, street) }
                    if let city = picked.city, !city.isEmpty { onFieldChange(.city, city) }
                    if let state = picked.state, !state.isEmpty { onFieldChange(.state, state) }
                    if let zip = picked.zipcode, !zip.isEmpty { onFieldChange(.zip, zip) }
                }
            }
        }
    }
}
