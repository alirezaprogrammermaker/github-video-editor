import { Config } from "@remotion/cli/config";

// Quality settings
Config.setCrf(18);
Config.setJpegQuality(90);
Config.setConcurrency(4);  // ubuntu-latest runners are 4 vCPU
Config.setOverwriteOutput(true);
