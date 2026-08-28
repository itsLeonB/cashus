export const queryKeys = {
  profile: {
    current: ["profile"] as const,
    subscription: ["profile", "subscription"] as const,
  },
  profiles: {
    all: ["profiles"] as const,
    search: (query: string) => ["profiles", "search", query] as const,
  },
  friendships: {
    all: ["friendships"] as const,
    detail: (id: string) => ["friendships", id] as const,
  },
  friendRequests: {
    all: ["friend-requests"] as const,
    sent: ["friend-requests", "sent"] as const,
    received: ["friend-requests", "received"] as const,
  },

  debts: {
    all: ["debts"] as const,
    summary: ["debts", "summary"] as const,
    recent: ["debts", "recent"] as const,
  },
  calculationMethods: {
    all: ["calculation-methods"] as const,
  },
  transferMethods: {
    all: ["transfer-methods"] as const,
    profile: (profileId: string) =>
      ["profile-transfer-methods", profileId] as const,
    filter: (filter: string) => ["transfer-methods", filter] as const,
  },

  groupExpenses: {
    all: ["group-expenses"] as const,
    detail: (id: string) => ["group-expenses", id] as const,
    status: (status?: string, ownership?: string) => {
      if (status && ownership)
        return ["group-expenses", status, ownership] as const;
      if (status) return ["group-expenses", status] as const;
      if (ownership) return ["group-expenses", "all", ownership] as const;
      return ["group-expenses"] as const;
    },
    recent: ["group-expenses", "recent"] as const,
  },

  notifications: {
    unread: ["notifications", "unread"] as const,
  },

  plans: {
    active: ["plans"] as const,
  },
} as const;
