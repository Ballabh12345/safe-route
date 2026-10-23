# Safe Route

Static personal safety companion site.

## Local development

```bash
npm install
npm run dev
```

## Optional routing

Safe Route uses OpenStreetMap and Carto tiles by default. To draw real road routes instead of straight-line estimates, create a free OpenRouteService API key and paste it into **Your settings → Free routing API key**. The key is stored only in this browser.

```bash
npm run deploy        # preview deployment
npm run deploy:prod   # production deployment
```

First-time deploy will prompt you to log in and link the project. For CI, set
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` environment variables.