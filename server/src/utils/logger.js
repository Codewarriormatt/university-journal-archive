const isProduction = process.env.NODE_ENV === "production";

function log(level, message, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(data && Object.keys(data).length ? { data } : {})
  };

  if (isProduction) {
    process.stdout.write(JSON.stringify(entry) + "\n");
  } else {
    const prefix = `[${entry.timestamp}] ${level.toUpperCase()}`;
    if (data && Object.keys(data).length) {
      console[level === "error" ? "error" : "log"](prefix, message, data);
    } else {
      console[level === "error" ? "error" : "log"](prefix, message);
    }
  }
}

export const logger = {
  info: (message, data = {}) => log("info", message, data),
  warn: (message, data = {}) => log("warn", message, data),
  error: (message, data = {}) => log("error", message, data)
};
