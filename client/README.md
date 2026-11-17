This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Memories

The `/memories` page loads the signed-in user's records and, while they are
mutually linked, their partner's records from the authenticated
`GET /api/memories` endpoint. Memories remain owned by their creator in MongoDB.
The home page shows the two most recent memories from the current couple through
`GET /api/memories/recent`. Unlinking stops sharing the former partner's
memories.

Adding a memory uploads its photo to Cloudinary and saves its details to
MongoDB. Uploads accept JPEG, PNG, or WebP images up to 5 MB and require the
Cloudinary environment variables listed below. Likes are stored per account,
so the selected state and count persist when the page is reloaded.

## Partner invitations

The home card can create a single-use invitation link that expires after seven
days. The invitee can register or sign in from that link to connect both
accounts. Invitation codes are stored as hashes in MongoDB.

## Couple profile

The `/us` page loads the signed-in user's partner, the current couple's memory
count, and the shared anniversary and love note from the authenticated partner
profile API. Anniversary dates and the single shared note are stored per paired
account pair in MongoDB. Notes can be up to 500 characters. The invitation
section uses the same single-use, seven-day link flow as the home page.

Account settings let a user update their display name, change their password
after verifying the current password, and upload a profile image. Image uploads
require `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
`CLOUDINARY_API_SECRET` in the server environment. Unlinking preserves the
shared profile in both accounts. Either former partner can propose deletion
with a shared 8-64 character secret; both must enter the same secret and
confirm before the shared profile is removed.

## Real-time chat

The `/chat` page loads the latest 50 messages from MongoDB and listens for new
messages and partner presence through authenticated Socket.IO connections.
Older history is fetched in pages as needed. Only users with a reciprocal
partner link can access the conversation; unlinking disconnects both users.
Messages remain stored but are not accessible while the users are unpaired.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
