export type ProjectDocumentKind = "setting" | "outline" | "chapter";

export type ProjectDocumentMeta = {
  kind: ProjectDocumentKind;
  directory: string;
  fileName: string;
  title: string;
  relativePath: string;
  updatedAt: string;
  preview: string;
};

export type ProjectDocument = ProjectDocumentMeta & {
  content: string;
};
