#!/usr/bin/env node

import { main } from "./cli.js";

main(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`awstui: ${message}`);
  process.exitCode = 1;
});
