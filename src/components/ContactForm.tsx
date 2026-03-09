import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { contactSchema, type ContactFormData } from "@/lib/schema.contact";

export default function ContactForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const [status, setStatus] = useState<"idle" | "success" | "failure">("idle");

  const onSubmit = async (data: ContactFormData) => {
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Network response was not ok");

      setStatus("success");
      reset();
    } catch (error) {
      console.error("Error:", error);
      setStatus("failure");
    }
  };

  if (status === "success") {
    return (
      <div className="space-y-6 w-full max-w-lg border border-zinc-800 p-6">
        <h2 className="text-xl mb-4">Thank you!</h2>
        <p className="text-zinc-400">
          We've received your message and will be in touch soon.
        </p>
      </div>
    );
  }

  if (status === "failure") {
    return (
      <div className="space-y-6 w-full max-w-lg border border-zinc-800 p-6">
        <h2 className="text-xl mb-4">Something went wrong</h2>
        <p className="text-zinc-400">
          Please try again or email us directly at{" "}
          <a href="mailto:amy@theadpharm.com" className="text-white underline">
            amy@theadpharm.com
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-6 w-full max-w-lg border border-zinc-800 p-6"
      onSubmit={handleSubmit(onSubmit)}
    >
      {/* Honeypot — visually hidden, not reachable by keyboard or screen readers. Bots fill it; real users never will. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "auto", width: "1px", height: "1px", overflow: "hidden" }}>
        <label htmlFor="website">Website</label>
        <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <h2 className="text-xl mb-4">Get in touch</h2>
      <div>
        <label htmlFor="firstName" className="block text-zinc-400">
          First Name
        </label>
        <input
          {...register("firstName", { required: true })}
          type="text"
          id="firstName"
          name="firstName"
          required
          className="mt-1 block w-full bg-black border border-zinc-800 py-2 px-3 text-white focus:outline-none focus:border-orange-500"
        />
        {errors.firstName && (
          <p className="text-xs pl-1 pt-1 text-left text-red-500">
            {errors.firstName.message?.toString()}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="lastName" className="block text-zinc-400">
          Last Name
        </label>
        <input
          {...register("lastName", { required: false })}
          type="text"
          id="lastName"
          name="lastName"
          className="mt-1 block w-full bg-black border border-zinc-800 py-2 px-3 text-white focus:outline-none focus:border-orange-500"
        />
      </div>

      <div>
        <label htmlFor="organization" className="block text-zinc-400">
          Organization
        </label>
        <input
          {...register("organization", { required: false })}
          type="text"
          id="organization"
          name="organization"
          className="mt-1 block w-full bg-black border border-zinc-800 py-2 px-3 text-white focus:outline-none focus:border-orange-500"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-zinc-400">
          Email
        </label>
        <input
          {...register("email", { required: true })}
          type="email"
          id="email"
          name="email"
          required
          className="mt-1 block w-full bg-black border border-zinc-800 py-2 px-3 text-white focus:outline-none focus:border-orange-500"
        />
        {errors.email && (
          <p className="text-xs pl-1 pt-1 text-left text-red-500">
            {errors.email.message?.toString()}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="message" className="block text-zinc-400">
          How Can We Help?
        </label>
        <textarea
          {...register("message", { required: true })}
          id="message"
          name="message"
          required
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
          className="mt-1 block w-full bg-black border border-zinc-800 py-2 px-3 text-white focus:outline-none focus:border-orange-500 min-h-24 resize-none overflow-hidden"
        ></textarea>
        {errors.message && (
          <p className="text-xs pl-1 pt-1 text-left text-red-500">
            {errors.message.message?.toString()}
          </p>
        )}
      </div>

      <div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex flex-row justify-center items-stretch bg-orange-600 rounded-full px-6 py-2 mt-6 max-w-44 animate-fade-in-2"
        >
          Submit <ArrowRight className="ml-2 animate-pulse" />
        </button>
      </div>
    </form>
  );
}
