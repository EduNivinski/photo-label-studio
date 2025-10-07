// Production-safe logger - no sensitive data in production logs
const isProd = import.meta.env.PROD;

export const debug = (...args: unknown[]) => {
  if (!isProd) console.log("[DEBUG]", ...args);
};

export const error = (...args: unknown[]) => {
  console.error("[ERROR]", ...args);
};

export const info = (...args: unknown[]) => {
  if (!isProd) console.info("[INFO]", ...args);
};
