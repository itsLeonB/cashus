# Keep duplicated Create/Update Huma Input bodies

An architecture review found several handlers (`PlanVersion`, `ExpenseItem`, `OtherFee`, and partially `Plan`/`Subscription`) declare near-identical `Create<X>Input.Body` and `Update<X>Input.Body` structs, and considered extracting a shared `<X>Body` type referenced by both. We decided to keep the duplication: reading two flat, self-contained structs is less mental overhead than tracing a shared or embedded base type, even though the field lists repeat. Don't re-propose collapsing these without a stronger reason than the duplication itself.
