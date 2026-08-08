import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Link from "next/link";
import { Suspense } from "react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <Link href="/" className="font-semibold">
              Product Ad Studio
            </Link>
            <Suspense>
              <AuthButton />
            </Suspense>
          </div>
        </nav>

        <div className="flex-1 w-full max-w-5xl flex flex-col justify-center gap-6 p-5">
          <h1 className="text-4xl font-bold tracking-tight">
            Turn product photos into ads
          </h1>
          <p className="text-muted-foreground max-w-xl">
            Upload a product photo and generate professional product shots and
            animated video ads with AI.
          </p>
        </div>

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-8">
          <ThemeSwitcher />
        </footer>
      </div>
    </main>
  );
}
