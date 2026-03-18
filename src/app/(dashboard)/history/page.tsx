import { redirect } from "next/navigation";

export default async function HistoryPage() {
  redirect("/dashboard?section=history");
}
