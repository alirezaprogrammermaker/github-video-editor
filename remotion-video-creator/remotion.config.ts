import { Config } from "@remotion/cli/config";

// Quality settings
Config.setCrf(18);  // Default quality (good balance)
Config.setJpegQuality(90);
Config.setConcurrency(4);  // Reduce concurrency to prevent frame drops
Config.setOverwriteOutput(true);
