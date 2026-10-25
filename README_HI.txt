A & I Chat — Starter Project
============================

Yeh ek starter build hai, live hosted website nahi. Ismein login/signup, profile/DP, text chat, photo/video upload ka basic flow, aur Recycle Bin ka prototype hai.

IMPORTANT:
- A aur I ke liye alag login accounts banayein. Ek shared ID/password se dono ki identity, privacy aur message ownership reliably alag nahi ho sakti.
- Is starter ko public production website ke roop mein launch karne se pehle security review zaroor karayein.
- Media bucket private hai; is demo ke current code mein public URL ka use hai, isliye private bucket ke liye yeh upload display flow production-ready nahi. Production version mein signed URLs aur participant-only Storage policies use karni hongi.
- Realtime publication Supabase dashboard mein enable karni hogi.
- Recycle Bin abhi manual restore/permanent delete ka basic prototype hai; 30-day auto-delete configured nahi hai.
- Chat encryption end-to-end nahi hai. Supabase database/storage access policies server-side security deti hain, E2E encryption nahi.

SETUP
1. Supabase project kholein.
2. SQL Editor > New query mein schema.sql ka poora content paste karke Run karein.
3. Project Settings > API se Project URL aur publishable/anon key copy karein.
4. app.js mein:
   SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
   SUPABASE_ANON_KEY = "YOUR_PUBLISHABLE_OR_ANON_KEY"
   replace karein. Service role/secret key browser mein KABHI na paste karein.
5. index.html, style.css, app.js ko ek hi folder mein rakhein.
6. Local test ke liye VS Code Live Server ya kisi static host se serve karein; file ko directly file:// se open na karein.
7. Supabase Auth settings mein email confirmation settings check karein. Do accounts banayein (A aur I).
8. Har account login karke Profile / DP mein display name A ya I set karein.
9. Chat ke liye doosre account ka profile select karke Open chat karein.

LIMITATIONS / NEXT STEPS
- Is starter mein group chats, voice/video calling, typing indicator, read receipts, end-to-end encryption, account recovery UI, signed media URLs, and automatic 30-day bin cleanup included nahi hain.
- Realtime messages ke liye Supabase Dashboard > Database > Publications mein messages table ko supabase_realtime publication mein add karein.
- Before launch: test RLS policies, private Storage access, message deletion/restoration and user consent.


FIXED BUILD NOTES
- Private bucket media is stored as a bucket path and displayed with signed URLs.
- Realtime publication setup is included in schema.sql.
- Run the updated schema.sql in Supabase SQL Editor before using the app.
- Security: the two account IDs should be the only intended accounts. Signup remains available unless you disable it in Supabase Auth settings.
