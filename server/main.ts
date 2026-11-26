// Start the Online Match server.
//   npm run server          (PORT, default 8787; DATABASE_URL, default file:magica.db)
// Production: DATABASE_URL=libsql://<db>.turso.io DATABASE_AUTH_TOKEN=... (see docs/online.md)

import { openDb } from './db';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 8787);
const db = await openDb();
createApp({ db }).listen(port, () => console.log(`magica server on :${port}`));
