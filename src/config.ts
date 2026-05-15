import fs from "fs";
import os from "os";
import path from "path";

export type Config = {
  dbUrl: string;
  currentUserName?: string;
};

function getConfigFilePath(): string {
  return path.join(os.homedir(), ".gatorconfig.json");
}

function writeConfig(cfg: Config): void {
  const diskConfig: Record<string, string> = {
    db_url: cfg.dbUrl,
  };

  if (cfg.currentUserName !== undefined) {
    diskConfig.current_user_name = cfg.currentUserName;
  }

  fs.writeFileSync(getConfigFilePath(), JSON.stringify(diskConfig, null, 2) + "\n", "utf8");
}

function validateConfig(rawConfig: any): Config {
  if (rawConfig === null || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    throw new Error("Config must be a JSON object.");
  }

  if (typeof rawConfig.db_url !== "string") {
    throw new Error("Config file must include a string 'db_url'.");
  }

  const config: Config = {
    dbUrl: rawConfig.db_url,
  };

  if (rawConfig.current_user_name !== undefined) {
    if (typeof rawConfig.current_user_name !== "string") {
      throw new Error("Config field 'current_user_name' must be a string.");
    }

    config.currentUserName = rawConfig.current_user_name;
  }

  return config;
}

export function readConfig(): Config {
  const contents = fs.readFileSync(getConfigFilePath(), "utf8");
  const raw = JSON.parse(contents);
  return validateConfig(raw);
}

export function setUser(cfg: Config, userName: string): void {
  const updatedConfig: Config = {
    ...cfg,
    currentUserName: userName,
  };

  writeConfig(updatedConfig);
}
