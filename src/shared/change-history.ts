export type ChangeOperation = "disable";

export type ChangeStatus = "applied" | "undone";

export type ChangePathRecord = {
  path: string;
  beforeState: string | null;
  afterState: string | null;
  backupFile: string | null;
  issues: string[];
};

export type ChangeRecord = {
  id: string;
  itemId: string;
  itemTitle: string;
  operation: ChangeOperation;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  status: ChangeStatus;
  affectedPaths: ChangePathRecord[];
  issueTrace: string[];
};
