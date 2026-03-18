import { redirect } from "next/navigation";

export default async function RemindersPage() {
  redirect("/dashboard?section=reminders");
}
