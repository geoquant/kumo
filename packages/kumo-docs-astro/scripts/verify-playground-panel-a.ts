import process from "node:process";

import {
  formatPlaygroundVerifierMarkdown,
  parsePlaygroundVerifierCliArgs,
  runPlaygroundVerifierCli,
} from "../src/lib/playground/verifier-cli";

async function main() {
  const options = parsePlaygroundVerifierCliArgs(process.argv.slice(2));
  const result = await runPlaygroundVerifierCli(options);

  process.stdout.write(
    `${formatPlaygroundVerifierMarkdown(result.report)}\n\nartifacts: ${result.artifactDir}\n`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
