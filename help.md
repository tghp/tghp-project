# _tghp-project_

Usage:

`tghp-project <type> <project-name> [<dest>] [options]`

Fetches the `src` repo, and extracts it to `dest` (or the current directory).

The `type` argument can be any of TGHP npm repos prefixed `@tghp/template-`. The final type used is `@tghp/template-<type>`

The `project-name` argument should be a human-readable name, e.g. "The Glasshouse Project". Quotes are likely needed for this argument.

The `dest` directory (or the current directory, if unspecified) must be empty

Options:

  `--help`,    `-h`  Show this message