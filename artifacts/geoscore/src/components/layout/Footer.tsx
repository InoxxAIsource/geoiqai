import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t bg-background py-12">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="font-semibold text-primary text-xl mb-4">GeoIQ</div>
          <p className="text-text-secondary text-sm">
            The command center for your startup's AI visibility. Track, optimize, and dominate AI search systems like ChatGPT, Gemini, and Perplexity.
          </p>
        </div>
        <div>
          <h4 className="font-medium text-text-primary mb-4">Product</h4>
          <div className="flex flex-col gap-2">
            <Link href="/pricing" className="text-sm text-text-secondary hover:text-primary">Pricing</Link>
            <Link href="/#how-it-works" className="text-sm text-text-secondary hover:text-primary">How it works</Link>
            <span className="text-sm text-text-secondary hover:text-primary cursor-pointer">Features</span>
          </div>
        </div>
        <div>
          <h4 className="font-medium text-text-primary mb-4">Resources</h4>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary hover:text-primary cursor-pointer">Blog</span>
            <span className="text-sm text-text-secondary hover:text-primary cursor-pointer">What is GEO?</span>
            <span className="text-sm text-text-secondary hover:text-primary cursor-pointer">Help Center</span>
          </div>
        </div>
        <div>
          <h4 className="font-medium text-text-primary mb-4">Legal</h4>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-text-secondary hover:text-primary cursor-pointer">Privacy Policy</span>
            <span className="text-sm text-text-secondary hover:text-primary cursor-pointer">Terms of Service</span>
            <span className="text-sm text-text-secondary hover:text-primary cursor-pointer">Contact Us</span>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t flex flex-col md:flex-row items-center justify-between">
        <p className="text-sm text-text-tertiary">© 2026 GeoIQ. geoiqai.com</p>
        <p className="text-sm text-text-tertiary mt-2 md:mt-0">Built for Indian founders.</p>
      </div>
    </footer>
  );
}
