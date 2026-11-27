"use client";

// Personal accounts (docs/ACCOUNTS.md). A login's profile is the task_members row whose `email` is the login email;
// the shell provides it to every page through AccountContext.
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Member } from "@/features/tasks/types";

export interface Account {
  email: string; // login email, lower case
  me: Member | null; // the profile (null = no member linked to this login yet)
}

export const AccountContext = createContext<Account>({ email: "", me: null });
export const useAccount = () => useContext(AccountContext);

/** Display name of an email: the linked member's name, else the part before "@". */
export function nameOf(email: string | null | undefined, people: Member[]): string {
  if (!email) return "Seseorang";
  return people.find((p) => p.email === email)?.name ?? email.split("@")[0];
}

/** The member of an email, or a grey stand-in (initial of the email) when that login has no profile yet. */
export function personFor(email: string, people: Member[]): Member {
  const m = people.find((p) => p.email === email);
  if (m) return m;
  const name = email.split("@")[0];
  return { id: email, name, initials: name.slice(0, 1).toUpperCase(), role: "", color: "#C4C7C5", email, goal: "", sort: 0, active: true };
}

/** Team members that have a login (the people a chat can be shared with). */
export async function listPeople(): Promise<Member[]> {
  const { data, error } = await createClient()
    .from("task_members")
    .select("*")
    .not("email", "is", null)
    .order("sort")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Member[];
}

/** listPeople() once per mount (empty until loaded). */
export function usePeople(): Member[] {
  const [people, setPeople] = useState<Member[]>([]);
  useEffect(() => {
    listPeople().then(setPeople, () => {});
  }, []);
  return people;
}
