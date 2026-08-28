import { Logo } from "@/components/Logo";
import { Link } from "react-router-dom";
import { SUPPORT_EMAIL } from "@/lib/constants";
import { subscriptionPurchaseEnabled } from "@/lib/flags";

export function FooterSection() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <Logo size="sm" />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              The simplest way to split bills and track shared expenses with
              friends.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Links</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  to="/#features"
                  className="hover:text-foreground transition-colors"
                >
                  Features
                </Link>
              </li>
              {subscriptionPurchaseEnabled && (
                <li>
                  <Link
                    to="/#pricing"
                    className="hover:text-foreground transition-colors"
                  >
                    Pricing
                  </Link>
                </li>
              )}
              <li>
                <Link
                  to="/privacy-policy"
                  className="hover:text-foreground transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms-of-service"
                  className="hover:text-foreground transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Contact</h4>
            <p className="text-sm text-muted-foreground">{SUPPORT_EMAIL}</p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © {year} Cashus. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
