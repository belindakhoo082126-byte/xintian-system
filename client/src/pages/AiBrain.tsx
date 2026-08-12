import { useState, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, LayoutDashboard, User, BookOpen, MessageSquare, FlaskConical, BarChart3, FileText, GitBranch, BellRing } from "lucide-react";
import AiBrainDashboard from "./AiBrainDashboard";
import AiBrainPersona from "./AiBrainPersona";

// Lazy load the embedded components to keep initial bundle smaller
const AiKnowledge = lazy(() => import("./AiKnowledge"));
const ReplyRules = lazy(() => import("./ReplyRules"));
const AiBrainLog = lazy(() => import("./AiBrainLog"));
const AiBrainTest = lazy(() => import("./AiBrainTest"));
const AiBrainAnalysis = lazy(() => import("./AiBrainAnalysis"));
const AiBrainRegression = lazy(() => import("./AiBrainRegression"));
const AiNotificationCenter = lazy(() => import("./AiNotificationCenter"));

const AI_BRAIN_TABS = new Set(["dashboard", "persona", "knowledge", "reply-rules", "log", "test", "analytics", "regression", "notifications"]);

export function getAiBrainInitialTab(search: string): string {
  const requestedTab = new URLSearchParams(search).get("tab");
  return requestedTab && AI_BRAIN_TABS.has(requestedTab) ? requestedTab : "dashboard";
}

export default function AiBrain() {
  const [activeTab, setActiveTab] = useState(() =>
    getAiBrainInitialTab(typeof window === "undefined" ? "" : window.location.search),
  );

  return (
    <div className="container max-w-6xl py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
          <Brain className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI 大脑</h1>
          <p className="text-sm text-muted-foreground">心田 AI 系统的统一管理中心</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-9 mb-6 h-auto">
          <TabsTrigger value="dashboard" className="flex flex-col items-center gap-1 py-2">
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-xs">总控制台</span>
          </TabsTrigger>
          <TabsTrigger value="persona" className="flex flex-col items-center gap-1 py-2">
            <User className="w-4 h-4" />
            <span className="text-xs">AI 人设</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex flex-col items-center gap-1 py-2">
            <BookOpen className="w-4 h-4" />
            <span className="text-xs">AI 知识库</span>
          </TabsTrigger>
          <TabsTrigger value="reply-rules" className="flex flex-col items-center gap-1 py-2">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs">固定回复</span>
          </TabsTrigger>
          <TabsTrigger value="log" className="flex flex-col items-center gap-1 py-2">
            <FileText className="w-4 h-4" />
            <span className="text-xs">AI 日志</span>
          </TabsTrigger>
          <TabsTrigger value="test" className="flex flex-col items-center gap-1 py-2">
            <FlaskConical className="w-4 h-4" />
            <span className="text-xs">AI 测试</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex flex-col items-center gap-1 py-2">
            <BarChart3 className="w-4 h-4" />
            <span className="text-xs">AI 分析</span>
          </TabsTrigger>
          <TabsTrigger value="regression" className="flex flex-col items-center gap-1 py-2">
            <GitBranch className="w-4 h-4" />
            <span className="text-xs">回归测试</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex flex-col items-center gap-1 py-2">
            <BellRing className="w-4 h-4" />
            <span className="text-xs">自动通知</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <AiBrainDashboard onNavigate={setActiveTab} />
        </TabsContent>

        <TabsContent value="persona">
          <AiBrainPersona />
        </TabsContent>

        <TabsContent value="knowledge">
          <Suspense fallback={<div className="py-12 text-center text-muted-foreground">加载中...</div>}>
            <AiKnowledge />
          </Suspense>
        </TabsContent>

        <TabsContent value="reply-rules">
          <Suspense fallback={<div className="py-12 text-center text-muted-foreground">加载中...</div>}>
            <ReplyRules />
          </Suspense>
        </TabsContent>

        <TabsContent value="log">
          <Suspense fallback={<div className="py-12 text-center text-muted-foreground">加载中...</div>}>
            <AiBrainLog />
          </Suspense>
        </TabsContent>

        <TabsContent value="test">
          <Suspense fallback={<div className="py-12 text-center text-muted-foreground">加载中...</div>}>
            <AiBrainTest />
          </Suspense>
        </TabsContent>

        <TabsContent value="analytics">
          <Suspense fallback={<div className="py-12 text-center text-muted-foreground">加载中...</div>}>
            <AiBrainAnalysis />
          </Suspense>
        </TabsContent>

        <TabsContent value="regression">
          <Suspense fallback={<div className="py-12 text-center text-muted-foreground">加载中...</div>}>
            <AiBrainRegression />
          </Suspense>
        </TabsContent>
        <TabsContent value="notifications">
          <Suspense fallback={<div className="py-12 text-center text-muted-foreground">加载中...</div>}>
            <AiNotificationCenter />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
        <FlaskConical className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{title} — 即将开发</h2>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
    </div>
  );
}
