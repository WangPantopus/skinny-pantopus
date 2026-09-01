package app.pantopus.android.data.api.models.mailbox.vault

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * T6.5e (P19.5) — Mailbox Vault DTOs for the routes in
 * `backend/routes/mailboxV2Phase2.js`. The phase-2 routes are mounted
 * at `/api/mailbox/v2/p2`.
 */

/** `GET /api/mailbox/v2/p2/vault/folders`. */
@JsonClass(generateAdapter = true)
data class VaultFoldersResponse(
    val folders: List<VaultFolderDto>,
)

@JsonClass(generateAdapter = true)
data class VaultFolderDto(
    val id: String,
    @Json(name = "user_id") val userId: String?,
    val drawer: String,
    val label: String,
    val icon: String?,
    val color: String?,
    val system: Boolean?,
    @Json(name = "item_count") val itemCount: Int?,
    @Json(name = "sort_order") val sortOrder: Int?,
    @Json(name = "created_at") val createdAt: String?,
)

/** `POST /api/mailbox/v2/p2/vault/folder` — `{ folder: ... }`. */
@JsonClass(generateAdapter = true)
data class VaultFolderResponse(
    val folder: VaultFolderDto?,
)

@JsonClass(generateAdapter = true)
data class CreateVaultFolderRequest(
    val drawer: String,
    val label: String,
    val icon: String? = null,
    val color: String? = null,
)

/** `GET /api/mailbox/v2/p2/vault/folder/:id/items`. */
@JsonClass(generateAdapter = true)
data class VaultFolderItemsResponse(
    val items: List<VaultMailItemDto>,
    val total: Int?,
)

@JsonClass(generateAdapter = true)
data class VaultMailItemDto(
    val id: String,
    @Json(name = "mail_type") val mailType: String?,
    val type: String?,
    val subject: String?,
    @Json(name = "display_title") val displayTitle: String?,
    @Json(name = "preview_text") val previewText: String?,
    @Json(name = "sender_address") val senderAddress: String?,
    @Json(name = "sender_business_name") val senderBusinessName: String?,
    @Json(name = "created_at") val createdAt: String?,
    val lifecycle: String?,
    @Json(name = "viewed_at") val viewedAt: String?,
    val attachments: List<String>?,
    @Json(name = "vault_folder_id") val vaultFolderId: String?,
)

/**
 * `GET /api/mailbox/v2/p2/vault/search` — route
 * `backend/routes/mailboxV2Phase2.js:1145`. `{ results, total, query }`;
 * each result is a `Mail` row decorated with the matched field and a short
 * excerpt around the hit.
 */
@JsonClass(generateAdapter = true)
data class VaultSearchResponse(
    val results: List<VaultSearchResultDto>,
    val total: Int?,
    val query: String?,
)

/** One server-side vault search hit. */
@JsonClass(generateAdapter = true)
data class VaultSearchResultDto(
    val id: String,
    val drawer: String?,
    @Json(name = "mail_type") val mailType: String?,
    val type: String?,
    val subject: String?,
    @Json(name = "preview_text") val previewText: String?,
    @Json(name = "sender_display") val senderDisplay: String?,
    @Json(name = "sender_business_name") val senderBusinessName: String?,
    @Json(name = "created_at") val createdAt: String?,
    @Json(name = "vault_folder_id") val vaultFolderId: String?,
    /** `sender` / `subject` / `content` — which column produced the hit. */
    @Json(name = "_matchField") val matchField: String?,
    /** ±30 characters of context around the hit. */
    @Json(name = "_matchExcerpt") val matchExcerpt: String?,
)

/** `POST /api/mailbox/v2/p2/vault/file`. */
@JsonClass(generateAdapter = true)
data class FileToVaultRequest(
    @Json(name = "mailId") val mailId: String,
    @Json(name = "folderId") val folderId: String,
)

@JsonClass(generateAdapter = true)
data class FileToVaultResponse(
    val message: String?,
    val folderId: String?,
)
