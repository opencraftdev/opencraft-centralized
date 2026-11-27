# Personal accounts, profiles & shared chats

Migration `supabase/migrations/029_accounts_and_shared_chats.sql` (safe to run more than once). Apply it **before**
deploying this code: the chat list selects `owner_email` and `chat_members`.

## Who can log in (Google only)

`app_allowed_emails` (see docs/DRIVE.md → "Login: Google only"):

| Email | Profile (`task_members`) |
|---|---|
| `rafireyhanwork@gmail.com` | Rafi |
| `bagasma.work@gmail.com` | Bagas |
| `deprasny@gmail.com` | Depras |
| `mrayandika.work@gmail.com` | Raka |
| `opencraft.dev@gmail.com` | — (the old shared login; keeps the chats made so far) |

Adding a person later: insert the email into `app_allowed_emails` (SQL editor, service role) and set it as
"Email login" on their member in Task Management → "Tim & project". If the Google OAuth app is still in *Testing*
mode, the email must also be a test user in Google Cloud Console.

## Profile

- A login's profile is the `task_members` row whose `email` = the login email (unique, lower case). The app layout
  loads it and provides `AccountContext` (`src/features/accounts/account.tsx`: `useAccount()` → `{ email, me }`).
- Top bar: the avatar shows the profile photo / initials; the account menu shows name + role, **Edit profil**
  (`ProfileDialog` = the Task Management member form with the email locked) and Sign out. A login without a profile
  gets **Buat profil**.
- The same profile is the person on the board: PIC / helpers, the person filter defaults to it, comment authors
  (`task_comments.author_email`) show its name.

## Chat history per person

- `chats.owner_email` (default: the caller's email; existing chats → their creator). Each person sees only their own
  chats and the chats shared with them (RLS: `chats_read`, `chat_messages_participants` via `can_access_chat()`).
- `chat_messages.author_email`: who sent a user message (null for answers). `chat_send` now refuses chats the caller
  is not in, and records owner / author.
- Only the owner trashes a chat (for everyone); the owner can't be changed (trigger `chats_guard`; the worker's
  service role is exempt). The worker is unchanged: it runs as service role and sees every chat.

## Shared chats

- `chat_members (chat_id, email, added_by, created_at)`: people added to a chat besides the owner. **Added = in**:
  there is no invitation to accept.
- Anyone in the chat can add a teammate (any allow-listed login that isn't the owner) from **Bagikan** (thread header
  button, or the ⋮ menu). The owner can remove people; a member can **Keluar dari chat** (also what "Hapus" becomes
  for a member).
- Realtime: `chats`, `chat_members` and `chat_messages` are in `supabase_realtime`. Open chat lists refresh at once;
  the person who was added gets a toast "<name> membagikan chat "<title>" denganmu" and the chat appears in their
  list (5 s polling stays as a fallback).
- In a shared chat every user bubble shows the sender's name + avatar ("Kamu" for your own); the header shows the
  members' avatars. The list marks shared chats with a people icon. Pinning is per chat (shared by its members).
