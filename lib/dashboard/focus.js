function buildProgress(project) {
  const chaptersDone = project?.chaptersCount ?? 0;
  const chapterTarget = project?.targetChapters ?? 0;
  const wordsDone = project?.totalWords ?? 0;
  const wordTarget = project?.targetWords ?? 0;

  return `${chaptersDone} / ${chapterTarget} 章 · ${wordsDone} / ${wordTarget} 字`;
}

function buildStage(project) {
  if (!project) {
    return "待创建项目";
  }

  if (project.chaptersCount > 0) {
    return "持续写作";
  }

  if (project.outlineFilesCount > 0) {
    return "首章准备";
  }

  if (project.settingFilesCount > 0) {
    return "补结构";
  }

  return "新项目起步";
}

function buildNextSteps(project) {
  if (!project) {
    return [
      "先创建项目并设为当前项目。",
      "到立项页补题材方向、目标读者和核心卖点。",
      "至少建立 1 份设定或卷纲，再进入写作链路。",
    ];
  }

  const steps = [];

  if (project.settingFilesCount === 0) {
    steps.push("先补 1 份主角卡、世界观或力量体系设定。");
  }

  if (project.outlineFilesCount === 0) {
    steps.push("补 1 份总纲或卷纲，先锁主线推进。");
  }

  if (project.chaptersCount === 0) {
    steps.push("去创作页创建首章任务书，启动正文链路。");
  }

  if (steps.length === 0) {
    steps.push(`继续推进第 ${project.currentChapter} 章，先补任务书再扩正文。`);
    steps.push("写完后去审查页看最新修补建议和风险提示。");
    steps.push("按当前节奏继续补卷纲与关键设定，避免后段失速。");
  }

  return steps.slice(0, 3);
}

function buildGaps(project) {
  if (!project) {
    return [
      "还没有当前项目，首页指标和工作流入口都无法联动。",
      "缺少设定与大纲时，后续规划无法形成稳定约束。",
      "没有章节素材时，审查和写作链路都不会产生有效反馈。",
    ];
  }

  const gaps = [];

  if (project.settingFilesCount === 0) {
    gaps.push("设定集为空，人物、规则和阵营约束还没立住。");
  }

  if (project.outlineFilesCount === 0) {
    gaps.push("大纲文件为空，主线节拍和卷级承诺还不清楚。");
  }

  if (project.chaptersCount === 0) {
    gaps.push("正文还没开章，当前项目缺少可审查的推进样本。");
  }

  if (gaps.length === 0) {
    const missingChapters = Math.max((project.targetChapters ?? 0) - project.chaptersCount, 0);
    const missingWords = Math.max((project.targetWords ?? 0) - project.totalWords, 0);

    gaps.push(`距离目标章节还差 ${missingChapters} 章，需要持续稳定推进。`);
    gaps.push(`距离目标字数还差 ${missingWords} 字，后续要守住更新节奏。`);
    gaps.push("当前已进入持续写作阶段，优先保持任务书、正文和审查闭环。");
  }

  return gaps.slice(0, 3);
}

export function buildDashboardFocus(project) {
  return {
    snapshot: [
      { label: "项目标题", value: project?.title ?? "未检测到" },
      { label: "创作阶段", value: buildStage(project) },
      { label: "进度", value: buildProgress(project) },
    ],
    nextSteps: buildNextSteps(project),
    gaps: buildGaps(project),
  };
}
