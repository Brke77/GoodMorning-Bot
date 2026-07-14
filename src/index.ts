import { loadEnvironment } from "./config/env.js";
import { runMorningBrief } from "./app.js";
import { configureLogger, logger, safeErrorMessage } from "./utils/logger.js";

async function main(): Promise<void> {
  const environment = loadEnvironment();
  configureLogger({
    level: environment.logLevel,
    secrets: [environment.openaiApiKey, environment.telegramBotToken],
  });

  logger.info("morning_brief.start", { dryRun: environment.dryRun });
  await runMorningBrief(environment);
}

main().catch((error: unknown) => {
  logger.error("morning_brief.failed", { reason: safeErrorMessage(error) });
  process.exitCode = 1;
});
