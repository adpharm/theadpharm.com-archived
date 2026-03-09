import { z } from "zod";

export const contactSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required" }),
  lastName: z.string().optional(),
  email: z.string().email({ message: "Invalid email address" }),
  organization: z.string().optional(),
  message: z.string().min(1, { message: "Message is required" }),
});

export type ContactFormData = z.infer<typeof contactSchema>;
