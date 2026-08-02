import useragent from "express-useragent";

/**
 * Extract real client IP address considering proxy headers and normalize IPv6/localhost
 * @param {import('express').Request} req 
 * @returns {string}
 */
export const getRealIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  let rawIp = forwarded ? forwarded.split(",")[0].trim() : (req.ip || req.socket?.remoteAddress || "127.0.0.1");

  if (!rawIp) return "127.0.0.1";

  // Clean IPv6 loopback notation for localhost
  if (rawIp === "::1" || rawIp === "::ffff:127.0.0.1" || rawIp === "127.0.0.1") {
    return "127.0.0.1 (Localhost)";
  }

  // Strip IPv4-mapped IPv6 prefix (e.g. ::ffff:192.168.1.1 -> 192.168.1.1)
  if (rawIp.startsWith("::ffff:")) {
    return rawIp.replace("::ffff:", "");
  }

  return rawIp;
};

/**
 * Parse User-Agent header into browser, os, and device category
 * @param {import('express').Request} req 
 * @returns {{ browser: string, os: string, device: 'Mobile' | 'Desktop' }}
 */
export const parseUserAgent = (req) => {
  const uaString = req.headers["user-agent"] || "";
  const source = useragent.parse(uaString);

  let browser = "Other Browser";

  // Strict browser detection logic
  if (/Edg\/|Edge\/|MSIE|Trident\//i.test(uaString)) {
    browser = "Microsoft Edge";
  } else if (/Chrome\/|CriOS\//i.test(uaString) && !/Edg\/|OPR\/|Vivaldi\/|Brave\//i.test(uaString)) {
    browser = "Google Chrome";
  } else if (/Firefox\//i.test(uaString)) {
    browser = "Firefox";
  } else if (/Safari\//i.test(uaString) && !/Chrome\//i.test(uaString)) {
    browser = "Safari";
  } else if (/OPR\/|Opera/i.test(uaString)) {
    browser = "Opera";
  } else if (source.browser) {
    browser = source.browser;
  }

  let os = source.os || "Unknown OS";
  if (source.isWindows) os = "Windows";
  if (source.isMac) os = "macOS";
  if (source.isLinux) os = "Linux";
  if (source.isAndroid) os = "Android";
  if (source.isiPhone) os = "iOS";
  if (source.isiPad) os = "iPadOS";

  // Device category: Mobile vs Desktop/Laptop
  const isMobile = source.isMobile || source.isTablet || /Android|iPhone|iPad|iPod|Mobile/i.test(uaString);
  let device = "Desktop";
  if (isMobile) {
    device = "Mobile";
  } else if (/Macintosh|Mac OS X|Windows|Linux/i.test(uaString)) {
    device = "Desktop/Laptop";
  }

  return { browser, os, device };
};

/**
 * Check if the current time in Asia/Kolkata (IST) is between 10:00 AM and 1:00 PM (10:00 - 13:00 IST)
 * @returns {{ allowed: boolean, currentIST: string }}
 */
export const isWithinMobileLoginWindow = () => {
  const now = new Date();

  // Get current IST time string and numbers
  const options = { timeZone: "Asia/Kolkata", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" };
  const formatter = new Intl.DateTimeFormat("en-US", { ...options, hour: "numeric", minute: "numeric", hour12: false });
  const parts = formatter.formatToParts(now);
  
  let hour = 0;
  let minute = 0;

  parts.forEach((part) => {
    if (part.type === "hour") hour = parseInt(part.value, 10);
    if (part.type === "minute") minute = parseInt(part.value, 10);
  });

  const istString = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });

  // Window: 10:00 AM (10:00) to 1:00 PM (13:00) IST inclusive
  const allowed = hour >= 10 && hour < 13;

  return { allowed, currentIST: istString, hour, minute };
};
