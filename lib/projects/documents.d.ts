import type { ProjectDocument, ProjectDocumentKind, ProjectDocumentMeta } from "@/types/documents";

export function listProjectDocuments(
  projectRoot: string,
  kind: ProjectDocumentKind,
): Promise<ProjectDocumentMeta[]>;

export function readProjectDocument(
  projectRoot: string,
  kind: ProjectDocumentKind,
  fileName: string,
): Promise<ProjectDocument>;

export function updateProjectDocument(
  projectRoot: string,
  kind: ProjectDocumentKind,
  fileName: string,
  content: string,
): Promise<ProjectDocument>;

export function createProjectDocument(
  projectRoot: string,
  kind: ProjectDocumentKind,
  input?: {
    title?: string;
    fileName?: string;
    content?: string;
  },
): Promise<ProjectDocument>;
