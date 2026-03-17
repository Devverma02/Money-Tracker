import { signOutAction } from "@/app/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="secondary-button rounded-lg px-3 py-1.5 text-sm font-medium"
      >
        Sign out
      </button>
    </form>
  );
}
