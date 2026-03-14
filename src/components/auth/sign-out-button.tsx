import { signOutAction } from "@/app/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="primary-button rounded-full px-5 py-3 text-sm font-semibold text-white"
      >
        Sign out
      </button>
    </form>
  );
}
