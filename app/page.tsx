import { auth } from "@/auth";
import { ApplicationForm } from "@/components/application-form";
import { SignInPanel } from "@/components/sign-in-panel";

export default async function Home() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-white">
      <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center py-12">
        {!session ? <SignInPanel /> : <ApplicationForm session={session} />}
      </main>
    </div>
  );
}
