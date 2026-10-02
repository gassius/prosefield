import { RECENT_AUTH_WINDOW_SECONDS } from "@/features/auth/constants";

export function isRecentAuthTime(
  authTimeSeconds: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  return nowSeconds - authTimeSeconds <= RECENT_AUTH_WINDOW_SECONDS;
}
