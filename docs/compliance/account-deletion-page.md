# Account deletion page (approved by the founder on October 7, 2026)

Google Play's Data safety form asks for a **Delete account URL**: a public web page, reachable
without the app, that names the app, gives the steps to delete an account, and says which data is
deleted or kept. The text below is the page at `https://pantopus.com/delete-account`
(`frontend/apps/web/src/app/delete-account/page.tsx`; keep the two in step). It is live after the
next production web deploy (checklist P9), and its URL goes in the Play form (`play-data-safety.md`).
The facts come from `DELETE /api/users/account` in `backend/routes/users.js` (checked October 6, 2026).

---

## Delete your Pantopus account

You can delete your account yourself in the Pantopus app or on the web.

- **In the app (iPhone or Android):** open the menu, tap **Profile & Privacy**, then
  **Delete account** at the bottom, and confirm with your password.
- **On the web:** sign in at pantopus.com, open your profile settings and choose
  **Delete Account**, then confirm.

Deletion is permanent.

If you can't sign in, email support@pantopus.com from the address on your account and we'll help
you delete it.

### Before you can delete

- Finish or cancel any task that is in progress, including tasks you're helping with.
- Let any payment that is still being processed or held finish.
- If you own a home where other people still live, hand ownership to one of them first.
- If your account has payment history, contact support@pantopus.com to close it. We keep records
  of completed payments where the law requires it.

### What we delete

- Your profile, sign-in and devices.
- Your posts, comments and the messages you sent.
- Your Support Train sign-ups: open ones are cancelled so organizers can fill the slot.
- Homes only you used: a home in private setup is deleted; if you were its last member, its
  household records are removed too.

### What stays

- Homes where other people still live keep their shared household records, without your name.
- Records of completed payments that the law requires us to keep.

---

Notes for review:

- The steps match the in-app help on iOS and Android ("Profile & Privacy → Delete account") and the
  web profile settings page; L3 verified deletion on all three on October 6. Support address from
  the contact page: support@pantopus.com.
- The payment-history rule reflects the current code: accounts with any settled payment can't be
  deleted in the app yet and are closed by support.
