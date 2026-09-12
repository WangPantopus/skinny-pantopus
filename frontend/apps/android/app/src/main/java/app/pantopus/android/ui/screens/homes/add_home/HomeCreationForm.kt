@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.add_home

/** Kept only alongside the original command in encrypted recovery storage. */
fun AddHomeFormState.creationSnapshot(): Map<String, String> =
    mapOf(
        "street" to address.street, "unit" to address.unit, "city" to address.city,
        "state" to address.state, "zip" to address.zipCode, "role" to checkNotNull(role).claimedRole,
        "nickname" to details.nickname, "homeType" to details.homeType.wireValue,
        "justMoved" to details.justMoved.toString(), "bedrooms" to details.bedrooms,
        "bathrooms" to details.bathrooms, "sqFt" to details.sqFt, "lotSqFt" to details.lotSqFt,
        "yearBuilt" to details.yearBuilt, "description" to details.description,
    )

fun restoreHomeCreationForm(saved: Map<String, String>): AddHomeFormState {
    require(saved.keys.containsAll(AddHomeFormState(role = AddHomeRole.Owner).creationSnapshot().keys))
    return AddHomeFormState(
        address =
            AddHomeAddressFields(
                saved.getValue("street"),
                saved.getValue("unit"),
                saved.getValue("city"),
                saved.getValue("state"),
                saved.getValue("zip"),
            ),
        role = AddHomeRole.entries.first { it.claimedRole == saved.getValue("role") },
        details =
            AddHomeDetailsFields(
                nickname = saved.getValue("nickname"),
                homeType = checkNotNull(AddHomeHomeType.fromCanonical(saved.getValue("homeType"))),
                justMoved = saved.getValue("justMoved").toBooleanStrict(),
                bedrooms = saved.getValue("bedrooms"), bathrooms = saved.getValue("bathrooms"),
                sqFt = saved.getValue("sqFt"), lotSqFt = saved.getValue("lotSqFt"),
                yearBuilt = saved.getValue("yearBuilt"), description = saved.getValue("description"),
            ),
    )
}
