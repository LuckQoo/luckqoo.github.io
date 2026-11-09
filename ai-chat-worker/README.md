# AI Chat Worker

The Worker validates Clerk session JWTs against the production Clerk JWKS and accepts requests only from the EPOCH storefront. A separate D1 database tracks hashed user identifiers and UTC daily usage; conversation content is sent to the model but is not stored by this Worker. The initial limits are 10 successful replies per user and 50 globally per UTC day. No credentials belong in Git.

The dashboard-managed Worker `epoch-ai-chat-backend` requires a D1 binding named `DB` (initialize it using `schema.sql`), a `MODEL_URL`, and an encrypted `MODEL_API_KEY`. Supported hosts are explicitly allowlisted in `src/index.js`. Model inference must remain disabled until its endpoint and authentication are tested. The Hugging Face Space currently requires a matching dedicated secret, separate from its repository-write token, and access controls for its training interface.

Install dependencies with `npm ci`, run `npm test`, then bundle `src/index.js` as an ES module for dashboard deployment. Dashboard bindings and secrets must be preserved when deploying. The Worker does not currently implement the old optional website-search feature; `searched` is always false.
