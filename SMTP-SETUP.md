# SMTP setup for Gateways

SMTP is used by the Fastify backend to send the six-digit email-verification
code. The Next.js frontend does not send mail and must never receive SMTP
credentials.

The backend already includes Nodemailer, primary/fallback SMTP support, and a
test command at `scripts/test-email.ts`. No new mail dependency is required.

## 1. Local development without sending real mail

Run a local SMTP inbox:

```sh
docker run --rm --name gateways-mailpit \
  -p 1025:1025 -p 8025:8025 \
  axllent/mailpit
```

Copy the backend repository's `.env.example` to `.env` and set these values in
that backend `.env`. The `src/backend/env*` files in this frontend repository
are reference templates only; the running Fastify service does not read them.

```dotenv
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Gateways 2026 <no-reply@localhost>"
OTP_EXPIRY_MINUTES=15
```

Start the backend, then send a test message from the backend repository:

```sh
npx tsx scripts/test-email.ts you@example.com
```

Open [http://localhost:8025](http://localhost:8025) to read the message. If
the backend itself runs inside Docker, use `host.docker.internal` instead of
`127.0.0.1` for `SMTP_HOST`.

## 2. Real SMTP provider

For Gmail, enable 2-Step Verification and create a Google App Password. Use
the app password, not the normal Gmail password:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-account@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM="Gateways 2026 <your-account@gmail.com>"
```

For SendGrid, use a verified sender and an API key as the SMTP password:

```dotenv
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM="Gateways 2026 <verified-sender@your-domain.com>"
```

Port `587` uses STARTTLS and should use `SMTP_SECURE=false`; port `465` uses
implicit TLS and should use `SMTP_SECURE=true`.

Do not paste the values into chat or commit them. Put them only in the backend
host's secret environment settings. The fallback variables are optional:
`SMTP_FALLBACK_HOST`, `SMTP_FALLBACK_PORT`, `SMTP_FALLBACK_SECURE`,
`SMTP_FALLBACK_USER`, `SMTP_FALLBACK_PASS`, and `SMTP_FALLBACK_FROM`.

## 3. Verify the complete flow

1. In the backend environment, set `NODE_ENV=development`, the database values,
   and the SMTP values above.
2. Start the backend and confirm `http://localhost:4000/health` responds.
3. Start the frontend with `REGISTRATION_API_URL=http://127.0.0.1:4000` and
   `NEXT_PUBLIC_USE_API_BACKEND=true` in the frontend `.env.local`.
4. Sign up at `http://localhost:3000/auth/login?mode=signup`.
5. Confirm the code arrives in Mailpit or the real inbox, enter it in the
   frontend, and confirm the dashboard opens.

If the backend prints `[DEV EMAIL LOG]`, it is not using SMTP. `EAUTH` or a
Gmail `535` response usually means the provider rejected the credentials; for
Gmail, use an App Password. `ECONNREFUSED` usually means the SMTP host/port is
wrong or blocked by the hosting provider.

For deployment, configure the same variables in the backend service only. The
frontend service needs the backend URL and CORS settings, but never SMTP
credentials.
