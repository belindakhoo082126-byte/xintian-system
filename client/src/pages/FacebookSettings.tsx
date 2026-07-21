import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, CheckCircle2, XCircle, AlertCircle, Send } from "lucide-react";
import { toast } from "sonner";

export default function FacebookSettings() {
  useAuth();
  const { data: status } = trpc.messenger.status.useQuery();
  const testSend = trpc.messenger.testSend.useMutation();
  const sendCustomMessage = trpc.messenger.sendCustomMessage.useMutation();

  const [testPsid, setTestPsid] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const webhookUrl = status
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${status.webhookUrl}`
    : "";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast.success(`已复制${label}`);
  };

  const handleTestSend = async () => {
    if (!testPsid.trim()) {
      toast.error("请输入 PSID");
      return;
    }
    try {
      const result = await testSend.mutateAsync({
        psid: testPsid.trim(),
        message: testMessage.trim() || undefined,
      });
      if (result.success) {
        toast.success("测试消息发送成功！");
      } else {
        toast.error(`发送失败: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(error?.message || "发送失败");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Facebook 集成设置</h1>
        <p className="text-muted-foreground mt-1">管理 Facebook Messenger、Webhook 和 API 连接</p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle>连接状态</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">Page ID</p>
                <p className="text-sm text-muted-foreground">{status?.pageId || "未配置"}</p>
              </div>
              {status?.pageId ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">App ID</p>
                <p className="text-sm text-muted-foreground">{status?.appId || "未配置"}</p>
              </div>
              {status?.appId ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">Page Access Token</p>
                <p className="text-sm text-muted-foreground">
                  {status?.hasPageAccessToken ? "已配置" : "未配置"}
                </p>
              </div>
              {status?.hasPageAccessToken ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">App Secret</p>
                <p className="text-sm text-muted-foreground">
                  {status?.hasAppSecret ? "已配置" : "未配置"}
                </p>
              </div>
              {status?.hasAppSecret ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">Catalog API Token</p>
                <p className="text-sm text-muted-foreground">
                  {status?.hasCatalogToken ? "已配置" : "未配置"}
                </p>
              </div>
              {status?.hasCatalogToken ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook 配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-blue-900">在 Facebook 开发者面板中配置 Webhook</p>
                <p className="text-sm text-blue-700">
                  请将以下 URL 和验证口令填入 Facebook 开发者面板的 Webhook 设置中。
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label>回调网址 (Callback URL)</Label>
              <div className="flex gap-2 mt-1">
                <Input value={webhookUrl} readOnly className="font-mono text-sm" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(webhookUrl, "回调网址")}
                >
                  {copied === "回调网址" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <Label>验证口令 (Verify Token)</Label>
              <div className="flex gap-2 mt-1">
                <Input value={status?.verifyToken || ""} readOnly className="font-mono text-sm" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(status?.verifyToken || "", "验证口令")}
                >
                  {copied === "验证口令" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <p className="text-sm text-amber-800">
              <strong>操作步骤：</strong><br />
              1. 回到 Facebook 开发者面板<br />
              2. 进入 Messenger API 设置<br />
              3. 在「配置 Webhook」区域填入以上回调网址和验证口令<br />
              4. 勾选订阅字段：messages, messaging_postbacks, feed, comments<br />
              5. 点击「验证并保存」<br />
              6. 在「生成访问口令」区域点击「添加订阅」为心田主页添加 Webhook 订阅
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Test Messenger */}
      <Card>
        <CardHeader>
          <CardTitle>测试 Messenger 消息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-gray-50 border p-4">
            <p className="text-sm text-gray-600">
              输入客户的 PSID（Page-Scoped ID）来发送测试消息。注意：在应用审核通过前，只能向应用管理员、开发者和测试者发送消息。
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label>PSID (Page-Scoped ID)</Label>
              <Input
                value={testPsid}
                onChange={(e) => setTestPsid(e.target.value)}
                placeholder="输入客户的 PSID"
                className="mt-1"
              />
            </div>

            <div>
              <Label>消息内容（可选）</Label>
              <Textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="输入要发送的测试消息内容"
                className="mt-1"
                rows={3}
              />
            </div>

            <Button
              onClick={handleTestSend}
              disabled={testSend.isPending || !testPsid.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              {testSend.isPending ? "发送中..." : "发送测试消息"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feature Summary */}
      <Card>
        <CardHeader>
          <CardTitle>已集成功能</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Webhook 接收端点</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Messenger 文字消息发送</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Messenger 按钮消息发送</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Messenger 图片/视频发送</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">会员入群 Flow 自动发送</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">评论自动回复</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">私聊关键词自动回复</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <Badge variant="secondary">待审核</Badge>
              <span className="text-sm">直播捉单（需应用审核）</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
