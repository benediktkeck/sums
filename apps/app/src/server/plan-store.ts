import { desc, eq, isNotNull } from "drizzle-orm";
import { VersionTree, type VersionRepo } from "@/lib/store/version-tree";
import type { Db } from "./db/client";
import { appState, planVersions } from "./db/schema";

export { ConflictError, NotFoundError } from "@/lib/store/errors";
export { COALESCE_WINDOW_MS, type CommitInput } from "@/lib/store/version-tree";

const HEAD_KEY = "head";

/** Plan versions in SQLite (`plan_versions`, head pointer in `app_state`). */
export function sqliteVersionRepo(db: Db): VersionRepo {
  return {
    get: (id) => db.select().from(planVersions).where(eq(planVersions.id, id)).get(),
    insert: (values) => db.insert(planVersions).values(values).returning().get(),
    update: (id, patch) => db.update(planVersions).set(patch).where(eq(planVersions.id, id)).returning().get(),
    newestChild: (id) =>
      db.select().from(planVersions).where(eq(planVersions.parentId, id)).orderBy(desc(planVersions.id)).limit(1).get(),
    list: ({ limit, labeledOnly }) =>
      db
        .select()
        .from(planVersions)
        .where(labeledOnly ? isNotNull(planVersions.label) : undefined)
        .orderBy(desc(planVersions.id))
        .limit(limit)
        .all(),
    getHead: () => {
      const r = db.select().from(appState).where(eq(appState.key, HEAD_KEY)).get();
      return r ? Number(r.value) : null;
    },
    setHead: (id) =>
      void db
        .insert(appState)
        .values({ key: HEAD_KEY, value: String(id) })
        .onConflictDoUpdate({ target: appState.key, set: { value: String(id) } })
        .run(),
    transaction: (fn) => db.transaction(() => fn()),
  };
}

/** The plan's version history, stored in SQLite. */
export class PlanStore extends VersionTree {
  constructor(db: Db, now: () => number = Date.now) {
    super(sqliteVersionRepo(db), now);
  }
}
