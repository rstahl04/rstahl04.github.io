import { cookies } from "next/headers";
import { GeneratorApp } from "@/app/components/GeneratorApp";
import { PublicHome } from "@/app/components/PublicHome";
import { hasAppAccess, parseSessionCookie } from "@/lib/auth";

export default async function Home() {
  const cookieStore = await cookies();
  const user = parseSessionCookie(cookieStore.get("prompter_session")?.value);

  if (!user || !hasAppAccess(user)) {
    return <PublicHome />;
  }

  return <GeneratorApp user={user} />;
}
