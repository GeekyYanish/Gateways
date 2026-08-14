import { redirect } from "next/navigation";

export const metadata = { title: "Enter the Realm — Parallax" };

export default function CreateCharacterPage() {
  // Keep old bookmarks safe while removing the character-builder experience.
  // Every account now receives its character from signup/OAuth/backend repair.
  redirect("/travelling");
}
