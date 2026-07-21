import { Config } from "@remotion/cli/config";

// Quality settings
Config.setCrf(18);
Config.setJpegQuality(90);
Config.setConcurrency(1);  // 1 for CI stability (2 cores only)
Config.setOverwriteOutput(true);
