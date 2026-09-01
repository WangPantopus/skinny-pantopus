//
//  SavedPlacesPreviews.swift
//  Pantopus
//

import SwiftUI

#if DEBUG
#Preview("Populated") {
    NavigationStack { SavedPlacesView(viewModel: .previewLoaded()) }
}

#Preview("Empty") {
    NavigationStack { SavedPlacesView(viewModel: .previewEmpty()) }
}
#endif
