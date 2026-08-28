import {
  Receipt,
  Users,
  TrendingUp,
  Camera,
  CreditCard,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { subscriptionPurchaseEnabled } from "@/lib/flags";

const baseFeatures = [
  {
    icon: Receipt,
    title: "Split Expenses",
    description: "Divide bills fairly among friends with flexible splitting.",
  },
  {
    icon: TrendingUp,
    title: "Real-Time Balances",
    description: "Instantly see who owes who across all your friends.",
  },
  {
    icon: Users,
    title: "Friend Management",
    description: "Add friends and track shared expenses effortlessly.",
  },
  {
    icon: Camera,
    title: "Receipt Upload",
    description: "Snap a photo of your bill and extract items automatically.",
  },
  {
    icon: Clock,
    title: "Expense History",
    description: "Full timeline of all expenses and debt transactions.",
  },
];

const features = subscriptionPurchaseEnabled
  ? [
      ...baseFeatures,
      {
        icon: CreditCard,
        title: "Flexible Plans",
        description: "Start free and upgrade as your needs grow.",
      },
    ]
  : baseFeatures;

export function FeaturesSection() {
  return (
    <section className="py-16 sm:py-24" id="features">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold font-display">
            Everything you need to{" "}
            <span className="text-gradient-primary">split bills</span>
          </h2>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto">
            Powerful features designed for hassle-free expense sharing.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="border-border/50 bg-card/50 hover:border-primary/30 transition-colors duration-200 w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
            >
              <CardContent className="p-6 space-y-3">
                <div className="gradient-primary rounded-lg p-2.5 w-fit">
                  <feature.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <h3 className="font-semibold font-display">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
