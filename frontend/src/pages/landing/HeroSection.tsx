import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Receipt, Users, TrendingUp } from "lucide-react";

export function HeroSection() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <section className="relative overflow-hidden py-16 sm:py-24 lg:py-32">
      {/* Background glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-15 blur-3xl bg-primary" />
      </div>

      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text content */}
          <div className="text-center lg:text-left space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display leading-tight tracking-tight">
              Split bills{" "}
              <span className="text-gradient-primary">effortlessly</span> with
              friends.
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-lg mx-auto lg:mx-0">
              Track group expenses, know who owes who, and stay organized — all
              in one place.
            </p>
            {!isLoading && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Button size="lg" variant="premium" asChild>
                  <Link to={isAuthenticated ? "/dashboard" : "/register"}>
                    {isAuthenticated ? "Go to Dashboard" : "Get Started"}
                    <ArrowRight className="h-5 w-5 ml-1" />
                  </Link>
                </Button>
                {!isAuthenticated && (
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/login">Login</Link>
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Visual — feature highlights */}
          <div className="hidden lg:grid grid-cols-1 gap-4">
            {[
              {
                icon: Receipt,
                title: "Smart Bill Splitting",
                desc: "Upload receipts and split items automatically",
              },
              {
                icon: Users,
                title: "Group Expenses",
                desc: "Manage shared costs with any group of friends",
              },
              {
                icon: TrendingUp,
                title: "Balance Tracking",
                desc: "Always know who owes who in real time",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="glass rounded-xl p-5 flex items-start gap-4 animate-fade-up"
              >
                <div className="gradient-primary rounded-lg p-2.5 shrink-0">
                  <item.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
