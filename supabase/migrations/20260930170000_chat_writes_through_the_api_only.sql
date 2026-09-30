-- Backwards compatible: yes. Drops row-level-security policies only; no table,
-- column, function or row changes. The backend writes every chat row as
-- service_role, which bypasses row-level security, and no app reaches PostgREST
-- directly (web, iOS and Android call the API; none ships a Supabase client or
-- the anon key), so nothing the product does uses these policies.
--
-- The chat rules live in the API: who may join a task chat (#908), closed rooms
-- refusing messages, edits and reactions (#923, #935), block checks, business
-- identity and rate limits. These policies let a signed-in person with the
-- anon key write chat rows straight through PostgREST around all of that.
--
-- Today only one of them works: "Users can create chat rooms" lets any
-- signed-in person insert a room of any type, for example a second 'gig' room
-- for someone else's task. get_or_create_gig_chat then picks one of the two
-- rooms with LIMIT 1, and the dispute evidence's maybeSingle() lookup fails.
-- (Reproduced on a local stack with a fixture account: 201, then two gig rooms.)
-- The others are blocked only by accident: the "Participants can view room
-- participants" policy on ChatParticipant queries ChatParticipant itself, so
-- any policy that consults it fails with 42P17 (infinite recursion). Fixing
-- that recursion would make them live, so they go too. Read (SELECT) policies
-- stay as they are.
SET LOCAL lock_timeout='5s';

DROP POLICY "Users can create chat rooms" ON public."ChatRoom";

DROP POLICY "Participants can send messages" ON public."ChatMessage";
DROP POLICY "Senders can update their own messages" ON public."ChatMessage";

DROP POLICY "Room owners/admins can add others" ON public."ChatParticipant";
DROP POLICY "Participants can add themselves to rooms" ON public."ChatParticipant";

DROP POLICY "Active participants can add reactions" ON public."MessageReaction";
DROP POLICY "messagereaction_insert_participant" ON public."MessageReaction";
DROP POLICY "Users can delete their own reactions" ON public."MessageReaction";
DROP POLICY "messagereaction_delete_own" ON public."MessageReaction";

DROP POLICY "Participants can create typing indicators" ON public."ChatTyping";
DROP POLICY "Users can update their own typing indicators" ON public."ChatTyping";
