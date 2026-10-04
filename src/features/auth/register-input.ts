import { z } from "@/lib/zod";
import { siteCopy } from "@/content/site";
import { registerPasswordSchema } from "@/features/auth/password";

/** Shared register input schema (not a Server Action module). */
export const registerInputSchema = z.object({
  email: z.string().trim().email({ message: siteCopy.auth.invalidEmail }),
  password: registerPasswordSchema,
});
