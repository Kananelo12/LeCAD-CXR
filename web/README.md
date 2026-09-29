# web — Next.js frontend

Not scaffolded yet. When you get here:

```bash
npx create-next-app@latest web --typescript --app --tailwind --eslint
```

Frontend only — no API routes in the request path. Calls FastAPI through a
rewrite so the browser sees one origin:

```js
// next.config.js
async rewrites() {
  return [{ source: "/api/:path*", destination: `${process.env.API_URL}/:path*` }];
}
```

Every screen that shows a prediction must also show that this is decision
support and not a diagnosis. The disclaimer travels in the API response
payload, so render it from there rather than hardcoding it.
