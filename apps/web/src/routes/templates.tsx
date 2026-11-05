import { useState } from "react";
import type { ResumeTemplate } from "@resumeflow/shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { HomeHeader } from "@/components/home-header";
import { TemplateCard } from "@/components/template-card";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { createResume, createResumeFromTemplate } from "@/lib/resume-store";
import { RESUME_TEMPLATES } from "@/templates";

export const Route = createFileRoute("/templates")({
  component: TemplatesPage,
});

function TemplatesPage() {
  useDocumentTitle("模板中心");
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>("全部");
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(
    null,
  );

  const categories = [
    "全部",
    ...new Set(RESUME_TEMPLATES.map((t) => t.category)),
  ];

  const filteredTemplates =
    activeCategory === "全部"
      ? RESUME_TEMPLATES
      : RESUME_TEMPLATES.filter((t) => t.category === activeCategory);

  async function handleUseTemplate(template: ResumeTemplate) {
    try {
      setLoadingTemplateId(template.id);
      const resume = await createResumeFromTemplate(template);
      toast.success(`已基于「${template.name}」创建简历`);
      await navigate({
        to: "/resumes/$resumeId",
        params: { resumeId: resume.id },
      });
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      toast.error(`创建失败: ${msg}`);
    } finally {
      setLoadingTemplateId(null);
    }
  }

  async function handleCreateBlank() {
    try {
      const resume = await createResume();
      await navigate({
        to: "/resumes/$resumeId",
        params: { resumeId: resume.id },
      });
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      toast.error(msg);
    }
  }

  return (
    <div className="min-h-full flex flex-col bg-background">
      <HomeHeader
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateBlank}
            className="gap-1.5 font-medium text-xs shadow-xs"
          >
            <FilePlus2 className="size-3.5" />
            新建空白简历
          </Button>
        }
      />

      <main className="flex-1 w-full px-6 lg:px-10 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">精选模板中心</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              选择一份喜欢的简历模板，开始创建你的简历
            </p>
          </div>

          {/* 分类筛选胶囊 */}
          <div className="flex items-center gap-1.5 rounded-lg border bg-muted/40 p-1">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  activeCategory === category
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* 模板网格卡片展示 */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={handleUseTemplate}
              loading={loadingTemplateId === template.id}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
