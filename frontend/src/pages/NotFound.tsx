import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Seo } from "@/components/Seo";
import { Home } from "lucide-react";

const NotFound = () => {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-background p-4">
      <Seo title="Page Not Found" noindex />
      <Logo size="lg" className="mb-8" />
      <h1 className="text-6xl font-display font-bold text-gradient-primary mb-4">
        404
      </h1>
      <p className="text-xl text-muted-foreground mb-8">Page not found</p>
      <Button asChild>
        <Link to="/login">
          <Home className="h-4 w-4 mr-2" />
          Back to Home
        </Link>
      </Button>
    </div>
  );
};

export default NotFound;
