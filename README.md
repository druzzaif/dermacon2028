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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Faculty venue routes

The faculty venue map is available at `/venue` and can be shared directly with attendees.

### Deploying on Vercel

1. Sign in to Vercel and deploy this folder with `npx vercel`, or import the repository if it has been pushed to GitHub. Complete the prompts and use the production deployment when ready.
2. Vercel assigns an HTTPS address ending in `.vercel.app`; a custom domain is optional.
3. Add the app's required environment variables in the Vercel project settings.
4. Redeploy after adding or changing a variable: use **Deployments → Redeploy**, push a commit when using Git integration, or run `npx vercel --prod` from this folder.

Google Apps Script is deployed separately from the Next.js app. After changing `google-script/Code.js` or `google-script/Template.html`, create and deploy a new version of the Apps Script web app so live faculty emails use the latest template and server-side email pacing.
