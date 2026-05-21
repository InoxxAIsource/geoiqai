import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuthGuard } from "@/hooks/use-auth-guard";

export function Navbar() {
  const { isAuthenticated } = useAuthGuard();

  return (
    <nav className="border-b bg-background sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-semibold text-primary text-xl tracking-tight">
          GEOscore
        </Link>
        <div className="hidden md:flex items-center gap-6">
          <Link href="/#how-it-works" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">How it works</Link>
          <Link href="/pricing" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">Pricing</Link>
          <span className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer">Blog</span>
          <span className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer">What is GEO</span>
        </div>
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button variant="default">Dashboard</Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="outline" className="border-primary text-primary hover:bg-primary-light">Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
