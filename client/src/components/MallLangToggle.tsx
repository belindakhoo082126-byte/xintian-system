import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";

export function MallLangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-sm"
      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
    >
      <Languages className="h-4 w-4" />
      {lang === "zh" ? "EN" : "中文"}
    </Button>
  );
}
