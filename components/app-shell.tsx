import Link from "next/link";
import type { ReactNode } from "react";

import { appNavItems } from "@/lib/app/navigation";
import type { ProjectSummary } from "@/types/project";

type AppShellProps = {
  currentPath: string;
  project: ProjectSummary | null;
  title: string;
  description: string;
  children: ReactNode;
};

function projectSubtitle(project: ProjectSummary | null) {
  if (!project) {
    return "尚未创建项目";
  }

  const genre = project.genre || "未设定";
  return `${genre} / 第 ${project.currentChapter} 章`;
}

export function AppShell({
  currentPath,
  project,
  title,
  description,
  children,
}: AppShellProps) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="eyebrow">Webnovel Writer</p>
          <h1>创作台</h1>
          <p className="muted">{project ? project.title : "开始创作"}</p>
        </div>
        <nav className="nav">
          {appNavItems.map((item) => {
            const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? "nav-item active" : "nav-item"}
                aria-current={isActive ? "page" : undefined}
              >
                <span>{item.label}</span>
                <small>{item.description}</small>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="content">
        <header className="page-header">
          <div>
            <p className="eyebrow">当前工作区</p>
            <h2>{title}</h2>
            <p className="muted">{description}</p>
          </div>
          <div className="project-pill">
            <strong>{project?.title ?? "Webnovel Project"}</strong>
            <span>{projectSubtitle(project)}</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
