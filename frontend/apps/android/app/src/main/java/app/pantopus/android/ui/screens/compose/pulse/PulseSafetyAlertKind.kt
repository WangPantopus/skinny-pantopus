package app.pantopus.android.ui.screens.compose.pulse

/**
 * Backend `safetyAlertKind` values for Heads Up posts — mirrors mobile
 * `SAFETY_KINDS`.
 */
enum class PulseSafetyAlertKind(val key: String, val label: String) {
    Theft("theft", "Theft"),
    Vandalism("vandalism", "Vandalism"),
    Suspicious("suspicious", "Suspicious"),
    Hazard("hazard", "Hazard"),
    Scam("scam", "Scam"),
    Other("other", "Other"),
    ;

    companion object {
        fun fromKey(key: String): PulseSafetyAlertKind? = entries.firstOrNull { it.key == key }
    }
}
