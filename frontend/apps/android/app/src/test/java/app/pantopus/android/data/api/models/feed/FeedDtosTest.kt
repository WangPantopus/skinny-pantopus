@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.feed

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FeedDtosTest {
    private val moshi =
        Moshi.Builder()
            .add(KotlinJsonAdapterFactory())
            .build()

    @Test
    fun decodesSeededFeedRowWithNullUserId() {
        val json =
            """
            {
              "posts": [
                {
                  "id": "p_real",
                  "user_id": "u1",
                  "content": "Hello neighbors",
                  "created_at": "2026-06-07T00:00:00Z",
                  "post_type": "ask_local",
                  "like_count": 1,
                  "comment_count": 0,
                  "userHasLiked": false,
                  "creator": {
                    "id": "u1",
                    "username": "maria",
                    "name": "Maria L."
                  }
                },
                {
                  "id": "fact_1",
                  "user_id": null,
                  "title": "Did you know?",
                  "content": "Your neighborhood has a farmers market on Saturdays.",
                  "created_at": "2026-06-01T00:00:00Z",
                  "post_type": "general",
                  "like_count": 0,
                  "comment_count": 0,
                  "userHasLiked": false,
                  "creator": {
                    "id": null,
                    "name": "Pantopus",
                    "username": "pantopus",
                    "first_name": "Pantopus",
                    "last_name": null,
                    "profile_picture_url": null
                  }
                }
              ],
              "pagination": { "hasMore": false }
            }
            """.trimIndent()

        val response = moshi.adapter(FeedResponse::class.java).fromJson(json)!!
        assertEquals(2, response.posts.size)
        assertEquals("u1", response.posts[0].userId)
        assertNull(response.posts[1].userId)
        assertEquals("Pantopus", response.posts[1].creator?.displayName())
    }

    @Test
    fun decodesFeedWithObjectPaginationAndIdentityCreator() {
        val json =
            """
            {
              "posts": [
                {
                  "id": "p1",
                  "user_id": "u1",
                  "content": "Anyone know a plumber?",
                  "created_at": "2026-06-07T00:00:00Z",
                  "post_type": "ask_local",
                  "like_count": 0,
                  "comment_count": 0,
                  "userHasLiked": false,
                  "creator": {
                    "type": "local",
                    "id": "lp_1",
                    "handle": "maria",
                    "displayName": "Maria L.",
                    "avatarUrl": null
                  }
                }
              ],
              "pagination": {
                "nextCursor": { "createdAt": "2026-06-07T00:00:00Z", "id": "p1" },
                "hasMore": false
              }
            }
            """.trimIndent()

        val response = moshi.adapter(FeedResponse::class.java).fromJson(json)!!
        assertEquals(1, response.posts.size)
        assertEquals("Maria L.", response.posts[0].creator?.displayName())
        assertEquals("p1", response.pagination?.nextCursor?.id)
        assertEquals(false, response.pagination?.hasMore)
    }

    @Test
    fun decodesFeedPostMediaFields() {
        val json =
            """
            {
              "posts": [
                {
                  "id": "p_photo",
                  "user_id": "u1",
                  "content": "Check out this sunset",
                  "created_at": "2026-06-07T00:00:00Z",
                  "post_type": "general",
                  "like_count": 0,
                  "comment_count": 0,
                  "userHasLiked": false,
                  "media_urls": ["https://cdn.example.com/full.jpg"],
                  "media_thumbnails": ["https://cdn.example.com/thumb.jpg"],
                  "media_types": ["image"]
                }
              ]
            }
            """.trimIndent()

        val post = moshi.adapter(FeedResponse::class.java).fromJson(json)!!.posts.single()
        assertEquals(listOf("https://cdn.example.com/full.jpg"), post.mediaUrls)
        assertEquals(listOf("https://cdn.example.com/thumb.jpg"), post.mediaThumbnails)
        assertEquals(listOf("image"), post.mediaTypes)
    }
}
