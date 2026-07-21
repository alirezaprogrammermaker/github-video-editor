import { Config } from "@remotion/cli/config";

// Use system Chrome
Config.setBrowserExecutable("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");

// Quality settings
Config.setCrf(18);  // Default quality (good balance)
Config.setJpegQuality(90);
Config.setConcurrency(4);  // Reduce concurrency to prevent frame drops
Config.setOverwriteOutput(true);
