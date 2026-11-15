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

The faculty venue map is available at `/venue`. Faculty email links are generated from `APP_PUBLIC_URL`, which must be the public app origin (not `localhost`) for live emails.

### Deploying on Vercel

1. Sign in to Vercel and deploy this folder with `npx vercel`, or import the repository if it has been pushed to GitHub. Complete the prompts and use the production deployment when ready.
2. Vercel assigns an HTTPS address ending in `.vercel.app`; a custom domain is optional.
3. In the Vercel project, open **Settings → Environment Variables** and set `APP_PUBLIC_URL` to that exact HTTPS origin, for example `https://your-project.vercel.app`. Add the app's other required environment variables there as well.
4. Redeploy after adding or changing the variable: use **Deployments → Redeploy**, push a commit when using Git integration, or run `npx vercel --prod` from this folder.

The email sender uses `http://localhost:3000` only for local development. It rejects a production `APP_PUBLIC_URL` that is not HTTPS or that includes a path.

Google Apps Script is deployed separately from the Next.js app. After changing `google-script/Code.js` or `google-script/Template.html`, create and deploy a new version of the Apps Script web app so live faculty emails include the venue button and server-side email pacing.
