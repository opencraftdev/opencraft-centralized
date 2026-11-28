import { LoginForm } from "@/features/auth/components/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return <LoginForm error={error ?? null} next={next ?? null} />;
}
