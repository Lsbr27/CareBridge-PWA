
# Healthcare App UI Design

This is a code bundle for Healthcare App UI Design. The original project is available at https://www.figma.com/design/EK636Szg4u2IkxItYNFnns/Healthcare-App-UI-Design.

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Supabase Auth

The frontend now uses Supabase Auth with Google sign-in.

Environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Local development already reads them from `Frontend/.env.local`.

To finish Google login in the dashboard:

1. Enable Google in `Supabase Dashboard > Auth > Providers`.
2. Add `http://localhost:5173` as an authorized JavaScript origin in Google Cloud.
3. Add the Supabase callback URL shown in the Google provider screen as an authorized redirect URI in Google Cloud.
4. Add `http://localhost:5173/app` or `http://localhost:5173/**` to the Supabase redirect allow list if needed.

When a user signs up through Supabase Auth, a database trigger now creates the matching row in `public.profiles` automatically.
  
