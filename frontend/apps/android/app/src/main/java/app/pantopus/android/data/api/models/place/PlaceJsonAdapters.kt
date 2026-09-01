package app.pantopus.android.data.api.models.place

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.JsonReader
import com.squareup.moshi.JsonWriter
import com.squareup.moshi.Moshi
import com.squareup.moshi.adapters.EnumJsonAdapter
import java.lang.reflect.Type

/**
 * Moshi wiring for the Place Intelligence contract. Two factories,
 * registered in `di/NetworkModule.provideMoshi()` AHEAD of the generic
 * Kotlin factory:
 *
 * 1. [PlaceSectionEnvelopeAdapterFactory] — the envelope's `data`
 *    payload type depends on the SIBLING `id` field, which Moshi's
 *    `PolymorphicJsonAdapterFactory` (label-inside-the-object) cannot
 *    express. The hand-written adapter reads the whole envelope as a
 *    JSON value, switches on `id`, and decodes the payload with the
 *    right generated adapter. A malformed payload degrades that one
 *    section to `data = null` instead of failing the whole response
 *    (parity with the iOS `PlaceSectionEnvelope.init(from:)`).
 *
 * 2. [PlaceEnumAdapterFactory] — open display vocabularies decode
 *    unrecognized raw values to their UNKNOWN/fallback constant so a
 *    server vocabulary addition can't break older clients.
 */
class PlaceSectionEnvelopeAdapterFactory : JsonAdapter.Factory {
    override fun create(
        type: Type,
        annotations: Set<Annotation>,
        moshi: Moshi,
    ): JsonAdapter<*>? {
        if (annotations.isNotEmpty() || type != PlaceSectionEnvelope::class.java) return null
        return EnvelopeAdapter(moshi).nullSafe()
    }

    private class EnvelopeAdapter(
        private val moshi: Moshi,
    ) : JsonAdapter<PlaceSectionEnvelope>() {
        override fun fromJson(reader: JsonReader): PlaceSectionEnvelope? {
            @Suppress("UNCHECKED_CAST")
            val raw = reader.readJsonValue() as? Map<String, Any?> ?: return null
            val id = raw["id"] as? String ?: return null
            return PlaceSectionEnvelope(
                id = id,
                group = raw["group"] as? String ?: "",
                band = enumOrFallback(raw["band"], PlaceBand::class.java, PlaceBand.A),
                access = enumOrFallback(raw["access"], PlaceSectionAccess::class.java, PlaceSectionAccess.LOCKED),
                status = enumOrFallback(raw["status"], PlaceSectionStatus::class.java, PlaceSectionStatus.UNAVAILABLE),
                asOf = raw["as_of"] as? String,
                source = raw["source"] as? String,
                coverage = enumOrFallback(raw["coverage"], PlaceCoverage::class.java, PlaceCoverage.PARTIAL),
                unavailableReason = raw["unavailable_reason"] as? String,
                data = decodePayload(id, raw["data"]),
            )
        }

        private fun <E : Enum<E>> enumOrFallback(
            value: Any?,
            enumType: Class<E>,
            fallback: E,
        ): E {
            val rawString = value as? String ?: return fallback
            return runCatching { moshi.adapter(enumType).fromJsonValue(rawString) }
                .getOrNull() ?: fallback
        }

        /**
         * Decode the id-specific payload; a malformed payload degrades
         * this one section to null instead of failing the response (the
         * fixture tests are the drift alarm, not production decoding).
         */
        private fun decodePayload(
            id: String,
            data: Any?,
        ): PlaceSectionData? {
            if (data == null) return null

            fun <T> parse(clazz: Class<T>): T? = runCatching { moshi.adapter(clazz).fromJsonValue(data) }.getOrNull()
            return when (PlaceSectionId.from(id)) {
                PlaceSectionId.WEATHER ->
                    parse(PlaceWeatherData::class.java)?.let(PlaceSectionData::Weather)
                PlaceSectionId.AIR_QUALITY ->
                    parse(PlaceAirQualityData::class.java)?.let(PlaceSectionData::AirQuality)
                PlaceSectionId.ALERTS ->
                    parse(PlaceAlertsData::class.java)?.let(PlaceSectionData::Alerts)
                PlaceSectionId.SUNRISE_SUNSET ->
                    parse(PlaceSunriseSunsetData::class.java)?.let(PlaceSectionData::SunriseSunset)
                PlaceSectionId.GOOD_DAY_TO ->
                    parse(PlaceGoodDayData::class.java)?.let(PlaceSectionData::GoodDayTo)
                PlaceSectionId.YOUR_HOME ->
                    parse(PlaceYourHomeData::class.java)?.let(PlaceSectionData::YourHome)
                PlaceSectionId.HOME_SYSTEMS ->
                    parse(PlaceHomeSystemsData::class.java)?.let(PlaceSectionData::HomeSystems)
                PlaceSectionId.FLOOD ->
                    parse(PlaceFloodData::class.java)?.let(PlaceSectionData::Flood)
                PlaceSectionId.HEAT_COLD ->
                    parse(PlaceHeatColdData::class.java)?.let(PlaceSectionData::HeatCold)
                PlaceSectionId.SEISMIC ->
                    parse(PlaceSeismicData::class.java)?.let(PlaceSectionData::Seismic)
                PlaceSectionId.WILDFIRE ->
                    parse(PlaceWildfireData::class.java)?.let(PlaceSectionData::Wildfire)
                PlaceSectionId.LEAD_RADON ->
                    parse(PlaceLeadRadonData::class.java)?.let(PlaceSectionData::LeadRadon)
                PlaceSectionId.DRINKING_WATER ->
                    parse(PlaceDrinkingWaterData::class.java)?.let(PlaceSectionData::DrinkingWater)
                PlaceSectionId.ENVIRONMENTAL_HAZARDS ->
                    parse(PlaceEnvironmentalHazardsData::class.java)?.let(PlaceSectionData::EnvironmentalHazards)
                PlaceSectionId.BLOCK_DENSITY ->
                    parse(PlaceBlockDensityData::class.java)?.let(PlaceSectionData::BlockDensity)
                PlaceSectionId.CENSUS_CONTEXT ->
                    parse(PlaceCensusContextData::class.java)?.let(PlaceSectionData::CensusContext)
                PlaceSectionId.BILL_BENCHMARK ->
                    parse(PlaceBillBenchmarkData::class.java)?.let(PlaceSectionData::BillBenchmark)
                PlaceSectionId.INCENTIVES ->
                    parse(PlaceIncentivesData::class.java)?.let(PlaceSectionData::Incentives)
                PlaceSectionId.RENT_BAND ->
                    parse(PlaceRentBandData::class.java)?.let(PlaceSectionData::RentBand)
                PlaceSectionId.REAL_RENT ->
                    parse(PlaceRealRentData::class.java)?.let(PlaceSectionData::RealRent)
                PlaceSectionId.EXEMPTION_CHECK ->
                    parse(PlaceExemptionCheckData::class.java)?.let(PlaceSectionData::ExemptionCheck)
                PlaceSectionId.CIVIC_DISTRICTS ->
                    parse(PlaceCivicDistrictsData::class.java)?.let(PlaceSectionData::CivicDistricts)
                PlaceSectionId.CIVIC_ELECTION ->
                    parse(PlaceCivicElectionData::class.java)?.let(PlaceSectionData::CivicElection)
                PlaceSectionId.UNKNOWN -> null
            }
        }

        override fun toJson(
            writer: JsonWriter,
            value: PlaceSectionEnvelope?,
        ) {
            requireNotNull(value) { "envelope must not be null (nullSafe() handles null)" }
            writer.beginObject()
            writer.name("id").value(value.id)
            writer.name("group").value(value.group)
            writer.name("band").jsonValue(moshi.adapter(PlaceBand::class.java).toJsonValue(value.band))
            writer
                .name("access")
                .jsonValue(moshi.adapter(PlaceSectionAccess::class.java).toJsonValue(value.access))
            writer
                .name("status")
                .jsonValue(moshi.adapter(PlaceSectionStatus::class.java).toJsonValue(value.status))
            writer.name("as_of").value(value.asOf)
            writer.name("source").value(value.source)
            writer
                .name("coverage")
                .jsonValue(moshi.adapter(PlaceCoverage::class.java).toJsonValue(value.coverage))
            writer.name("unavailable_reason").value(value.unavailableReason)
            writer.name("data")
            when (val payload = value.data) {
                null -> writer.nullValue()
                is PlaceSectionData.Weather -> writeValue(writer, payload.value)
                is PlaceSectionData.AirQuality -> writeValue(writer, payload.value)
                is PlaceSectionData.Alerts -> writeValue(writer, payload.value)
                is PlaceSectionData.SunriseSunset -> writeValue(writer, payload.value)
                is PlaceSectionData.GoodDayTo -> writeValue(writer, payload.value)
                is PlaceSectionData.YourHome -> writeValue(writer, payload.value)
                is PlaceSectionData.HomeSystems -> writeValue(writer, payload.value)
                is PlaceSectionData.Flood -> writeValue(writer, payload.value)
                is PlaceSectionData.HeatCold -> writeValue(writer, payload.value)
                is PlaceSectionData.Seismic -> writeValue(writer, payload.value)
                is PlaceSectionData.Wildfire -> writeValue(writer, payload.value)
                is PlaceSectionData.LeadRadon -> writeValue(writer, payload.value)
                is PlaceSectionData.DrinkingWater -> writeValue(writer, payload.value)
                is PlaceSectionData.EnvironmentalHazards -> writeValue(writer, payload.value)
                is PlaceSectionData.BlockDensity -> writeValue(writer, payload.value)
                is PlaceSectionData.CensusContext -> writeValue(writer, payload.value)
                is PlaceSectionData.BillBenchmark -> writeValue(writer, payload.value)
                is PlaceSectionData.Incentives -> writeValue(writer, payload.value)
                is PlaceSectionData.RentBand -> writeValue(writer, payload.value)
                is PlaceSectionData.RealRent -> writeValue(writer, payload.value)
                is PlaceSectionData.ExemptionCheck -> writeValue(writer, payload.value)
                is PlaceSectionData.CivicDistricts -> writeValue(writer, payload.value)
                is PlaceSectionData.CivicElection -> writeValue(writer, payload.value)
            }
            writer.endObject()
        }

        private inline fun <reified T> writeValue(
            writer: JsonWriter,
            value: T,
        ) {
            writer.jsonValue(moshi.adapter(T::class.java).toJsonValue(value))
        }
    }
}

/**
 * Unknown-value fallbacks for the Place display vocabularies. One
 * factory so `provideMoshi()` stays a one-line registration.
 */
object PlaceEnumAdapterFactory : JsonAdapter.Factory {
    private val fallbacks: Map<Class<out Enum<*>>, Enum<*>> =
        mapOf(
            PlaceSectionAccess::class.java to PlaceSectionAccess.LOCKED,
            PlaceSectionStatus::class.java to PlaceSectionStatus.UNAVAILABLE,
            PlaceCoverage::class.java to PlaceCoverage.PARTIAL,
            WeatherConditionCode::class.java to WeatherConditionCode.UNKNOWN,
            AirQualityCategory::class.java to AirQualityCategory.UNKNOWN,
            WeatherAlertSeverity::class.java to WeatherAlertSeverity.UNKNOWN,
            FloodRiskLevel::class.java to FloodRiskLevel.UNKNOWN,
            SeismicDesignCategory::class.java to SeismicDesignCategory.UNKNOWN,
            LeadPaintRisk::class.java to LeadPaintRisk.UNKNOWN,
            PlaceDensityBucket::class.java to PlaceDensityBucket.UNKNOWN,
            BillUtilityKind::class.java to BillUtilityKind.UNKNOWN,
            // Without this, a fourth verdict from the server throws inside
            // decodePayload's runCatching and blanks the WHOLE good_day_to
            // section — including the tiles whose verdicts were valid. The
            // UNKNOWN constant and its doc comment promised forward
            // compatibility the factory was never told about. iOS handles
            // this in GoodDayVerdict's Decodable init.
            GoodDayVerdict::class.java to GoodDayVerdict.UNKNOWN,
            BenchmarkComparison::class.java to BenchmarkComparison.UNKNOWN,
            // Real Rent (Wave 3). `state` decides which of the two very
            // different cards renders, so an unrecognized value must land
            // on UNKNOWN — which renders neither — rather than throwing
            // inside decodePayload and blanking the whole section.
            RealRentState::class.java to RealRentState.UNKNOWN,
            RealRentScope::class.java to RealRentScope.UNKNOWN,
            RealRentStanding::class.java to RealRentStanding.UNKNOWN,
            ExemptionFilingStatus::class.java to ExemptionFilingStatus.UNKNOWN,
            AssessmentStance::class.java to AssessmentStance.UNKNOWN,
            MailboxCheckVerdict::class.java to MailboxCheckVerdict.UNKNOWN,
            MailboxFindingSeverity::class.java to MailboxFindingSeverity.INFO,
            MailboxPhysicalStatus::class.java to MailboxPhysicalStatus.NOT_RUN,
            ResidencyClaimScope::class.java to ResidencyClaimScope.UNKNOWN,
            ResidencyClaimStatus::class.java to ResidencyClaimStatus.EXPIRED,
            // ResidencyLetterStatus declares UNKNOWN but was never
            // registered, so the forward-compatibility promise its own
            // constant makes was not kept: an unrecognized status threw
            // and took the whole section's decode with it.
            ResidencyLetterStatus::class.java to ResidencyLetterStatus.UNKNOWN,
            FridgeCardStatus::class.java to FridgeCardStatus.REVOKED,
            IncentiveLevel::class.java to IncentiveLevel.UNKNOWN,
            IncentiveType::class.java to IncentiveType.UNKNOWN,
            CivicLevel::class.java to CivicLevel.UNKNOWN,
            BallotRaceType::class.java to BallotRaceType.UNKNOWN,
            PlacePreviewStatus::class.java to PlacePreviewStatus.UNKNOWN,
            PlacePreviewSectionStatus::class.java to PlacePreviewSectionStatus.UNAVAILABLE,
            PlacePreviewUnlock::class.java to PlacePreviewUnlock.UNKNOWN,
            MoneyLeadKind::class.java to MoneyLeadKind.UNKNOWN,
            // Unlisted (Wave 4). Every one of these is on the path of
            // someone trying to get their home address off the internet:
            // an unrecognized value must degrade to UNKNOWN — which the
            // UI renders as "not stated" — rather than throwing and
            // taking the whole removal list, the state program, and the
            // method note down with it.
            UnlistedRemovalMethod::class.java to UnlistedRemovalMethod.UNKNOWN,
            UnlistedRemovalStatus::class.java to UnlistedRemovalStatus.UNKNOWN,
            UnlistedPreviewStatus::class.java to UnlistedPreviewStatus.UNKNOWN,
        )

    override fun create(
        type: Type,
        annotations: Set<Annotation>,
        moshi: Moshi,
    ): JsonAdapter<*>? {
        if (annotations.isNotEmpty()) return null
        val match = fallbacks.entries.firstOrNull { it.key == type } ?: return null

        @Suppress("UNCHECKED_CAST")
        return unknownFallbackAdapter(match.key as Class<Enum<*>>, match.value)
    }

    private fun <E : Enum<E>> unknownFallbackAdapter(
        clazz: Class<out Enum<*>>,
        fallback: Enum<*>,
    ): JsonAdapter<E> {
        @Suppress("UNCHECKED_CAST")
        return EnumJsonAdapter
            .create(clazz as Class<E>)
            .withUnknownFallback(fallback as E)
            .nullSafe()
    }
}
