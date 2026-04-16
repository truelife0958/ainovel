"use client";

import { useState, type ReactNode } from "react";

import { Toolbar } from "@/components/toolbar";
import { ConnectionModal } from "@/components/connection-modal";
import { IdeationModal } from "@/components/ideation-modal";
import { ReviewModal } from "@/components/review-modal";
import { ProjectsModal } from "@/components/projects-modal";
import { BatchGenerateModal } from "@/components/batch-generate-modal";
import { ScaffoldGenerateModal } from "@/components/scaffold-generate-modal";
import { ReferenceModal } from "@/components/reference-modal";
import type { ProjectSummary } from "@/types/project";

type AppShellProps = {
  project: ProjectSummary | null;
  aiAvailable: boolean;
  children: ReactNode;
};

export function AppShell({ project, aiAvailable, children }: AppShellProps) {
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [ideationOpen, setIdeationOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [scaffoldOpen, setScaffoldOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [zenMode, setZenMode] = useState(false);

  return (
    <div className={`creation-shell${zenMode ? " zen-mode" : ""}`}>
      <Toolbar
        project={project}
        aiAvailable={aiAvailable}
        zenMode={zenMode}
        onOpenConnection={() => setConnectionOpen(true)}
        onOpenIdeation={() => setIdeationOpen(true)}
        onOpenReview={() => setReviewOpen(true)}
        onOpenProjects={() => setProjectsOpen(true)}
        onOpenBatch={() => setBatchOpen(true)}
        onOpenScaffold={() => setScaffoldOpen(true)}
        onOpenReference={() => setReferenceOpen(true)}
        onToggleZen={() => setZenMode(!zenMode)}
      />
      <main className="creation-main">
        {children}
      </main>

      {/* Modals */}
      <ConnectionModal open={connectionOpen} onClose={() => setConnectionOpen(false)} />
      <IdeationModal open={ideationOpen} onClose={() => setIdeationOpen(false)} />
      <ReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} />
      <ProjectsModal open={projectsOpen} onClose={() => setProjectsOpen(false)} />
      {project && (
        <>
          <BatchGenerateModal
            open={batchOpen}
            onClose={() => setBatchOpen(false)}
            targetChapters={project.targetChapters}
            currentChapter={project.currentChapter}
            existingChapterCount={project.chaptersCount}
          />
          <ScaffoldGenerateModal
            open={scaffoldOpen}
            onClose={() => setScaffoldOpen(false)}
            genre={project.genre}
            protagonistName=""
            goldenFingerName=""
          />
          <ReferenceModal
            open={referenceOpen}
            onClose={() => setReferenceOpen(false)}
          />
        </>
      )}
    </div>
  );
}

/* Welcome shell for when no project exists */
export function WelcomeShell({ aiAvailable }: {
  aiAvailable: boolean;
}) {
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);

  return (
    <div className="welcome-shell">
      <Toolbar
        project={null}
        aiAvailable={aiAvailable}
        onOpenConnection={() => setConnectionOpen(true)}
        onOpenIdeation={() => {}}
        onOpenReview={() => {}}
        onOpenProjects={() => setProjectsOpen(true)}
        onOpenBatch={() => {}}
        onOpenScaffold={() => {}}
        onOpenReference={() => {}}
      />
      <div className="welcome-content">
        <div className="welcome-brand-icon">W</div>
        <div>
          <h2>开始你的创作之旅</h2>
          <p className="muted welcome-desc">
            创建一个作品项目，定义核心设定，然后开始写作。
            AI 将协助你规划大纲、生成章节、审查问题。
          </p>
        </div>
        <div className="welcome-actions">
          <button
            type="button"
            className="action-button"
            onClick={() => setProjectsOpen(true)}
          >
            创建作品
          </button>
          <button
            type="button"
            className="action-button secondary"
            onClick={() => setConnectionOpen(true)}
          >
            配置 AI 连接
          </button>
        </div>
      </div>

      <ConnectionModal open={connectionOpen} onClose={() => setConnectionOpen(false)} />
      <ProjectsModal open={projectsOpen} onClose={() => setProjectsOpen(false)} />
    </div>
  );
}
