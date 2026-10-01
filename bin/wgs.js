#!/usr/bin/env node
import('../dist/cli.js')
  .then((cli) => cli.main())
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
