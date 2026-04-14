function genreLabel(genre) {
  return String(genre || "").trim() || "未设置题材";
}

export function buildProjectHeaderFocus(project) {
  if (!project) {
    return {
      title: "未检测到项目",
      subtitle: "请先创建或打开项目",
    };
  }

  return {
    title: project.title,
    subtitle: `${genreLabel(project.genre)} · 第 ${project.currentChapter} 章`,
  };
}

export function buildProjectWorkspaceRowFocus(project) {
  return {
    progressLabel: `${genreLabel(project.genre)} · 第 ${project.currentVolume} 卷 / 第 ${project.currentChapter} 章`,
    directoryLabel: `目录：${project.id}`,
  };
}
