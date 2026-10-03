import { z } from "zod";
import { registerPasswordSchema } from "@/features/auth/password";

/** Shared register input schema (not a Server Action module). */
export const registerInputSchema = z.object({
  email: z.string().trim().email({ message: "Enter a valid email address." }),
  password: registerPasswordSchema,
});
