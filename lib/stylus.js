import { basename, dirname, resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { ok } from "node:assert/strict";

import minimist from "minimist";
import { render } from "stylus";
import { mkdirp } from "mkdirp";

const args = minimist(process.argv.slice(2));

const USAGE =
  "Usage: stylus.js --out <out-dir> --cwd <cwd-dir> <entry-files...>";

ok(args._.length >= 0, "No entry files provided \n" + USAGE);
ok(args.out || args.o, "No out dir specified \n" + USAGE);

const OUT_DIR = args.out || args.o;
const ENTRY_FILES = args._;
const INIT_CWD = resolve(
  process.cwd(),
  args.cwd || process.env.INIT_CWD || ".",
);

await Promise.all(
  ENTRY_FILES
    .map(async (path) => {
      const INPUT = resolve(INIT_CWD, path);
      const OUTPUT = resolve(INIT_CWD, OUT_DIR, basename(path)).replace(
        /\.styl$/,
        ".css",
      );

      await mkdirp(dirname(OUTPUT));

      await writeFile(
        OUTPUT,
        render(
          (await readFile(INPUT)).toString(),
          {
            filename: INPUT,
          },
        ),
      );
    }),
)
  .then(() => console.log("Stylus build complete"));
