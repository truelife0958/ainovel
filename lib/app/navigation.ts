export type AppNavHref =
  | "/projects"
  | "/connection"
  | "/ideation"
  | "/workspace"
  | "/review";

export type AppNavItem = {
  href: AppNavHref;
  label: string;
  description: string;
};

export const appNavItems: AppNavItem[] = [
  {
    href: "/projects",
    label: "项目",
    description: "创建、切换与管理作品",
  },
  {
    href: "/connection",
    label: "连接",
    description: "接入 AI 能力",
  },
  {
    href: "/ideation",
    label: "立项",
    description: "定义作品核心",
  },
  {
    href: "/workspace",
    label: "创作",
    description: "设定、大纲与章节写作",
  },
  {
    href: "/review",
    label: "审查",
    description: "问题中心与修复入口",
  },
];
