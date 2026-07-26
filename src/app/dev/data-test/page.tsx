import { notFound } from "next/navigation";
import { DataTest } from "./data-test";

/** Dev-only data-layer test harness. Never ships to production. */
export default function DataTestPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DataTest />;
}
