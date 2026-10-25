import { PrismaClient } from "@prisma/client";

/** Scope top-level queries, including queries inside interactive transactions.
 * Nested writes are assembled only by the server after validating the team's
 * player IDs. Never pass arbitrary client-supplied Prisma arguments here.
 */
export function scopeTeamDb(database: PrismaClient, teamId: number) {
  if (!Number.isSafeInteger(teamId) || teamId <= 0) throw new Error("Invalid team scope");
  return database.$extends({
    name: "team-isolation",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const direct = ["Player", "Match", "AccessLog"].includes(model);
          const child = ["MatchPlayer", "MatchGoal", "MatchPoster", "MomBallot"].includes(model);
          if (!direct && !child) return query(args);
          const input = args as unknown as { where?: Record<string, unknown>; data?: Record<string, unknown> | Record<string, unknown>[] };
          if (operation === "upsert") throw new Error("Use explicit team create/update operations");
          if (!["create", "createMany", "createManyAndReturn"].includes(operation)) {
            const scope = direct ? { teamId } : { match: { teamId } };
            // Keep unique fields outside AND for findUnique/update/delete.
            // Compound unique selectors (e.g. matchId_voterHash) are valid only
            // at the top level, so append to AND without copying the selector.
            const previous = input.where?.AND;
            input.where = { ...input.where, AND: [...(Array.isArray(previous) ? previous : previous ? [previous] : []), scope] };
          }
          if (direct && input.data) {
            const enforce = (data: Record<string, unknown>) => {
              if ("team" in data) throw new Error("Team relations cannot be reassigned");
              return { ...data, teamId };
            };
            input.data = Array.isArray(input.data) ? input.data.map(enforce) : enforce(input.data);
          }
          return query(args);
        }
      }
    }
  });
}

export type TeamDb = ReturnType<typeof scopeTeamDb>;
