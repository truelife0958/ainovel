export function buildDashboardMetrics(project) {
  if (!project) {
    return [
      {
        label: "当前卷",
        value: "待创建",
        hint: "创建项目后自动同步卷进度",
      },
      {
        label: "当前章",
        value: "待创建",
        hint: "立项完成后再进入章节链路",
      },
      {
        label: "设定文件",
        value: "0 份",
        hint: "创建项目后开始沉淀设定资料",
      },
      {
        label: "大纲文件",
        value: "0 份",
        hint: "总纲、卷纲和节拍表会显示在这里",
      },
    ];
  }

  return [
    {
      label: "当前卷",
      value: `第 ${project.currentVolume} 卷`,
      hint: "项目进度",
    },
    {
      label: "当前章",
      value: `第 ${project.currentChapter} 章`,
      hint: "后续接写作任务书",
    },
    {
      label: "设定文件",
      value: `${project.settingFilesCount}`,
      hint: "设定资料可持续扩展",
    },
    {
      label: "大纲文件",
      value: `${project.outlineFilesCount}`,
      hint: "总纲、卷纲、节拍表入口",
    },
  ];
}
