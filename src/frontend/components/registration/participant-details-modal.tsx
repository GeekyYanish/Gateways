"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { BlockButton, BlockInput, BlockModal, BlockPanel, BlockSelect } from "@/frontend/components/mc";
import { repo } from "@/backend/data";
import { DataError, type ParticipantDetails, type Profile } from "@/backend/data/types";

/**
 * The participant details every registration needs.
 *
 * These nine fields are not a Gateways invention — they are the shape
 * `POST /v1/registrations` takes (BACKEND-API-CONTRACT.md §5), and the
 * registration console renders them directly in its intake table, drawers and
 * CSV exports. The option VALUES below must therefore stay exactly as they are;
 * only the labels are ours to phrase.
 *
 * Shown once. A `Profile` that already has these comes back pre-filled, so a
 * student entering their fourth event confirms rather than retypes — the
 * console models one Participant per person, matched on email, and asking for
 * the same nine answers per event invites them to disagree with each other.
 *
 * College, department and year are absent on purpose: character creation
 * already collected them, and this modal's caller checks
 * `isParticipantComplete()`, which covers both halves.
 */

const CATEGORIES = [
  ["participant", "Participant — competing in events"],
  ["delegate", "Delegate — attending, not competing"],
  ["accompanist", "Accompanist — supporting a performer"],
  ["faculty", "Faculty escort"],
  ["volunteer", "Volunteer"],
  ["guest", "Guest / Judge"],
] as const;

const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

const DIETS = [
  ["veg", "Vegetarian"],
  ["non_veg", "Non-vegetarian"],
  ["vegan", "Vegan"],
  ["jain", "Jain"],
] as const;

/** Indian mobile numbers are 10 digits; strip formatting before counting so
 *  "+91 98765 43210" is accepted, exactly as the console's CSV import does. */
const phone = (label: string) =>
  z
    .string()
    .refine((v) => v.replace(/\D/g, "").length >= 10, `Enter a valid 10-digit ${label}.`);

const schema = z.object({
  fullName: z.string().trim().min(3, "At least 3 characters."),
  phone: phone("mobile number"),
  gender: z.enum(["male", "female", "other"]),
  // A plain <input type="date"> yields "" when empty and "YYYY-MM-DD" otherwise,
  // which is already the wire format — no parsing, no timezone to get wrong.
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth.")
    .refine((v) => new Date(v) < new Date(), "Date of birth must be in the past."),
  category: z.enum(["participant", "delegate", "accompanist", "faculty", "volunteer", "guest"]),
  tshirtSize: z.enum(["XS", "S", "M", "L", "XL", "XXL"]),
  dietaryPref: z.enum(["veg", "non_veg", "vegan", "jain"]),
  emergencyName: z.string().trim().min(3, "Who should we call?"),
  emergencyPhone: phone("emergency number"),
});

type FormValues = z.infer<typeof schema>;

export interface ParticipantDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** Existing values to pre-fill from; null on a first registration. */
  profile: Profile | null;
  /** Fired after the details are saved, so the caller can register. */
  onSaved: (details: ParticipantDetails) => void | Promise<void>;
}

export function ParticipantDetailsModal({
  open,
  onOpenChange,
  userId,
  profile,
  onSaved,
}: ParticipantDetailsModalProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: profile?.fullName ?? "",
      phone: profile?.phone ?? "",
      gender: profile?.gender ?? "male",
      dateOfBirth: profile?.dateOfBirth ?? "",
      category: profile?.category ?? "participant",
      tshirtSize: profile?.tshirtSize ?? "M",
      dietaryPref: profile?.dietaryPref ?? "veg",
      emergencyName: profile?.emergencyName ?? "",
      emergencyPhone: profile?.emergencyPhone ?? "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await repo.profiles.update(userId, values);
      // Saving and registering are two steps and the caller owns the second, so
      // a failed registration leaves the details saved rather than discarding
      // nine fields the student just typed.
      await onSaved(values);
      onOpenChange(false);
    } catch (e) {
      setFormError(
        e instanceof DataError ? e.message : "Could not save your details. Try again.",
      );
    }
  });

  return (
    <BlockModal
      open={open}
      onOpenChange={onOpenChange}
      title="Your details"
      description="Needed once. We reuse these for every event you enter."
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-[calc(var(--mc-unit)*0.25)]">
        <BlockInput
          label="Full name"
          placeholder="As it should appear on your badge"
          autoComplete="name"
          error={errors.fullName?.message}
          {...register("fullName")}
        />

        <BlockInput
          label="Mobile number"
          type="tel"
          inputMode="tel"
          placeholder="98765 43210"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register("phone")}
        />

        <BlockInput
          label="Date of birth"
          type="date"
          autoComplete="bday"
          hint="Participants under 18 need guardian consent at the desk."
          error={errors.dateOfBirth?.message}
          {...register("dateOfBirth")}
        />

        <BlockSelect label="Gender" error={errors.gender?.message} {...register("gender")}>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </BlockSelect>

        <BlockSelect
          label="Category"
          hint="Most students are Participants."
          error={errors.category?.message}
          {...register("category")}
        >
          {CATEGORIES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </BlockSelect>

        <BlockSelect label="T-shirt size" error={errors.tshirtSize?.message} {...register("tshirtSize")}>
          {TSHIRT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </BlockSelect>

        <BlockSelect label="Food preference" error={errors.dietaryPref?.message} {...register("dietaryPref")}>
          {DIETS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </BlockSelect>

        <BlockInput
          label="Emergency contact name"
          placeholder="Parent or guardian"
          error={errors.emergencyName?.message}
          {...register("emergencyName")}
        />

        <BlockInput
          label="Emergency contact number"
          type="tel"
          inputMode="tel"
          placeholder="98765 43210"
          error={errors.emergencyPhone?.message}
          {...register("emergencyPhone")}
        />

        {formError ? (
          <BlockPanel
            variant="slot"
            padded="sm"
            role="alert"
            aria-live="assertive"
            className="border-mc-redstone text-mc-danger text-[16px]"
          >
            {formError}
          </BlockPanel>
        ) : null}

        <BlockButton
          type="submit"
          block
          size="lg"
          variant="emerald"
          loading={isSubmitting}
          className="mt-[var(--mc-unit)]"
        >
          Save and register
        </BlockButton>
      </form>
    </BlockModal>
  );
}
