import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { FooterSection } from "@/pages/landing/FooterSection";

export function LegalPageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border py-4">
        <nav aria-label="Home" className="container mx-auto px-4 max-w-4xl">
          <Link to="/">
            <Logo size="sm" />
          </Link>
        </nav>
      </header>
      <main className="container mx-auto px-4 max-w-4xl py-12 space-y-6 text-foreground">
        {children}
      </main>
      <FooterSection />
    </div>
  );
}
