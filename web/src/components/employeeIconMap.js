// Copyright (c) 2026 MeeJoy
//
// Maps each digital employee (skill) id to a lucide-react icon component
// and a brand color. Used by employee cards, panels, and popups.

import {
  AtSignIcon,
  BarChart3Icon,
  BookHeartIcon,
  CalculatorIcon,
  CalendarIcon,
  CameraIcon,
  ClipboardListIcon,
  FileTextIcon,
  KanbanIcon,
  MessageCircleIcon,
  Music2Icon,
  NewspaperIcon,
  PackageIcon,
  PenLineIcon,
  PlayCircleIcon,
  ShoppingCartIcon,
  StoreIcon,
  TargetIcon,
  TrendingUpIcon,
  TruckIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react"

const EmployeeIconMap = {
  // 新媒体运营部
  "topic-scheduler": { icon: CalendarIcon, color: "text-violet-600 bg-violet-50" },
  "content-writer": { icon: PenLineIcon, color: "text-sky-600 bg-sky-50" },
  "material-extractor": { icon: ClipboardListIcon, color: "text-amber-600 bg-amber-50" },
  "ai-news-analyst": { icon: NewspaperIcon, color: "text-blue-600 bg-blue-50" },
  "wechat-publisher": { icon: MessageCircleIcon, color: "text-green-600 bg-green-50" },
  "xiaohongshu-operator": { icon: BookHeartIcon, color: "text-rose-600 bg-rose-50" },

  // 销售部
  "moments-operator": { icon: TrendingUpIcon, color: "text-orange-600 bg-orange-50" },
  "customer-manager": { icon: UsersIcon, color: "text-indigo-600 bg-indigo-50" },
  "sales-follower": { icon: TargetIcon, color: "text-emerald-600 bg-emerald-50" },

  // 财务部
  "finance-assistant": { icon: CalculatorIcon, color: "text-teal-600 bg-teal-50" },

  // 项目部
  "project-assistant": { icon: KanbanIcon, color: "text-cyan-600 bg-cyan-50" },

  // 人事部
  "hr-assistant": { icon: UserCogIcon, color: "text-pink-600 bg-pink-50" },

  // IT部
  "data-dashboard": { icon: BarChart3Icon, color: "text-blue-600 bg-blue-50" },

  // 开放办公区
  "inventory-assistant": { icon: PackageIcon, color: "text-stone-600 bg-stone-100" },

  // 跨境电商部
  "amazon-operator": { icon: ShoppingCartIcon, color: "text-amber-600 bg-amber-50" },
  "tiktok-overseas-operator": { icon: Music2Icon, color: "text-zinc-600 bg-zinc-100" },
  "shopify-operator": { icon: StoreIcon, color: "text-lime-600 bg-lime-50" },
  "crossborder-logistics": { icon: TruckIcon, color: "text-slate-600 bg-slate-50" },

  // 海外社媒部
  "youtube-operator": { icon: PlayCircleIcon, color: "text-red-600 bg-red-50" },
  "instagram-operator": { icon: CameraIcon, color: "text-fuchsia-600 bg-fuchsia-50" },
  "twitter-operator": { icon: AtSignIcon, color: "text-sky-600 bg-sky-50" },
}

/** Default fallback for employees not in the map */
const DEFAULT = { icon: FileTextIcon, color: "text-muted-foreground bg-muted/60" }

/**
 * @param {string} employeeId
 * @returns {{ icon: import("lucide-react").LucideIcon, color: string }}
 */
export function getEmployeeIcon(employeeId) {
  return EmployeeIconMap[employeeId] || DEFAULT
}

export default EmployeeIconMap
