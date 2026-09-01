package app.pantopus.android.data.scheduling

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SchedulingOwnerTest {
    @Test
    fun personal_uses_scheduling_base_with_no_owner_fields() {
        val owner: SchedulingOwner = SchedulingOwner.Personal
        assertEquals("scheduling", owner.basePath)
        assertNull(owner.ownerType)
        assertNull(owner.ownerId)
    }

    @Test
    fun business_uses_scheduling_base_with_owner_query_fields() {
        val owner: SchedulingOwner = SchedulingOwner.Business("biz-1")
        assertEquals("scheduling", owner.basePath)
        assertEquals("business", owner.ownerType)
        assertEquals("biz-1", owner.ownerId)
    }

    @Test
    fun home_uses_home_alias_base_with_no_owner_fields() {
        val owner: SchedulingOwner = SchedulingOwner.Home("home-9")
        assertEquals("homes/home-9/scheduling", owner.basePath)
        assertNull(owner.ownerType)
        assertNull(owner.ownerId)
    }
}
