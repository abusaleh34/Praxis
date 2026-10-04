# Railway preview

`railway.ts` defines a dedicated, initially empty Railway project containing the private Praxis preview and its PostgreSQL database. Apply only after checking the selected project and reviewing `railway config plan`.

Shared secrets `PRAXIS_ADMIN_TOKEN` and `PRAXIS_PREVIEW_PASSWORD` must exist in Railway. No credential values belong in this directory. See [the deployment procedure](../docs/railway.md).
