import { signOutAction } from "@/app/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="primary-button rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
      >
        Sign out
      </button>
    </form>
  );
}
