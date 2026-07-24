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
import { useI18n } from "@/contexts/I18nContext";

export default function FacebookSettings() {
  useAuth();
  const { translate } = useI18n();
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
    toast.success(translate("已复制{label}", "Copied {label}", { label }));
  };

  const handleTestSend = async () => {
    if (!testPsid.trim()) {
      toast.error(translate("请输入 PSID", "Please enter PSID"));
      return;
    }
    try {
      const result = await testSend.mutateAsync({
        psid: testPsid.trim(),
        message: testMessage.trim() || undefined,
      });
      if (result.success) {
        toast.success(translate("测试消息发送成功！", "Test message sent successfully!"));
      } else {
        toast.error(translate("发送失败: {error}", "Failed to send: {error}", { error: result.error }));
      }
    } catch (error: any) {
      toast.error(error?.message || translate("发送失败", "Failed to send"));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{translate("Facebook 集成设置", "Facebook Integration Settings")}</h1>
        <p className="text-muted-foreground mt-1">{translate("管理 Facebook Messenger、Webhook 和 API 连接", "Manage Facebook Messenger, Webhooks, and API Connections")}</p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle>{translate("连接状态", "Connection Status")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">{translate("Page ID", "Page ID")}</p>
                <p className="text-sm text-muted-foreground">{status?.pageId || translate("未配置", "Not Configured")}</p>
              </div>
              {status?.pageId ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">{translate("App ID", "App ID")}</p>
                <p className="text-sm text-muted-foreground">{status?.appId || translate("未配置", "Not Configured")}</p>
              </div>
              {status?.appId ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">{translate("Page Access Token", "Page Access Token")}</p>
                <p className="text-sm text-muted-foreground">
                  {status?.hasPageAccessToken ? translate("已配置", "Configured") : translate("未配置", "Not Configured")}
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
                <p className="text-sm font-medium">{translate("App Secret", "App Secret")}</p>
                <p className="text-sm text-muted-foreground">
                  {status?.hasAppSecret ? translate("已配置", "Configured") : translate("未配置", "Not Configured")}
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
                <p className="text-sm font-medium">{translate("Catalog API Token", "Catalog API Token")}</p>
                <p className="text-sm text-muted-foreground">
                  {status?.hasCatalogToken ? translate("已配置", "Configured") : translate("未配置", "Not Configured")}
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
          <CardTitle>{translate("Webhook 配置", "Webhook Configuration")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-blue-900">{translate("在 Facebook 开发者面板中配置 Webhook", "Configure Webhooks in Facebook Developer Panel")}</p>
                <p className="text-sm text-blue-700">
                  {translate("请将以下 URL 和验证口令填入 Facebook 开发者面板的 Webhook 设置中。", "Please fill in the following URL and verification token in the Webhook settings of the Facebook Developer Panel.")}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label>{translate("回调网址 (Callback URL)", "Callback URL")}</Label>
              <div className="flex gap-2 mt-1">
                <Input value={webhookUrl} readOnly className="font-mono text-sm" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(webhookUrl, translate("回调网址", "Callback URL"))}
                >
                  {copied === translate("回调网址", "Callback URL") ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <Label>{translate("验证口令 (Verify Token)", "Verify Token")}</Label>
              <div className="flex gap-2 mt-1">
                <Input value={status?.verifyToken || ""} readOnly className="font-mono text-sm" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(status?.verifyToken || "", translate("验证口令", "Verify Token"))}
                >
                  {copied === translate("验证口令", "Verify Token") ? (
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
              <strong>{translate("操作步骤：", "Steps:")}</strong><br />
              1. {translate("回到 Facebook 开发者面板", "Go back to Facebook Developer Panel")}<br />
              2. {translate("进入 Messenger API 设置", "Go to Messenger API Settings")}<br />
              3. {translate("在「配置 Webhook」区域填入以上回调网址和验证口令", "In the 'Configure Webhook' section, fill in the above Callback URL and Verify Token")}<br />
              4. {translate("勾选订阅字段：messages, messaging_postbacks, feed, comments", "Check subscription fields: messages, messaging_postbacks, feed, comments")}<br />
              5. {translate("点击「验证并保存」", "Click 'Verify and Save'")}<br />
              6. {translate("在「生成访问口令」区域点击「添加订阅」为心田主页添加 Webhook 订阅", "In the 'Generate Access Token' section, click 'Add Subscription' to add Webhook subscription for Xintian Page")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Test Messenger */}
      <Card>
        <CardHeader>
          <CardTitle>{translate("测试 Messenger 消息", "Test Messenger Messages")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-gray-50 border p-4">
            <p className="text-sm text-gray-600">
              {translate("输入客户的 PSID（Page-Scoped ID）来发送测试消息。注意：在应用审核通过前，只能向应用管理员、开发者和测试者发送消息。", "Enter the customer's PSID (Page-Scoped ID) to send test messages. Note: Before the app is approved, messages can only be sent to app administrators, developers, and testers.")}
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label>{translate("PSID (Page-Scoped ID)", "PSID (Page-Scoped ID)")}</Label>
              <Input
                value={testPsid}
                onChange={(e) => setTestPsid(e.target.value)}
                placeholder={translate("输入客户的 PSID", "Enter customer's PSID")}
                className="mt-1"
              />
            </div>

            <div>
              <Label>{translate("消息内容（可选）", "Message Content (Optional)")}</Label>
              <Textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder={translate("输入要发送的测试消息内容", "Enter the content of the test message to send")}
                className="mt-1"
                rows={3}
              />
            </div>

            <Button
              onClick={handleTestSend}
              disabled={testSend.isPending || !testPsid.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              {testSend.isPending ? translate("发送中...", "Sending...") : translate("发送测试消息", "Send Test Message")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feature Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{translate("已集成功能", "Integrated Features")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">{translate("Webhook 接收端点", "Webhook Receiver Endpoint")}</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">{translate("Messenger 文字消息发送", "Messenger Text Message Sending")}</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">{translate("Messenger 按钮消息发送", "Messenger Button Message Sending")}</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">{translate("Messenger 图片/视频发送", "Messenger Image/Video Sending")}</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">{translate("会员入群 Flow 自动发送", "Member Group Entry Flow Auto-sending")}</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">{translate("评论自动回复", "Comment Auto-reply")}</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">{translate("私聊关键词自动回复", "Private Chat Keyword Auto-reply")}</span>
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <Badge variant="secondary">{translate("待审核", "Pending Review")}</Badge>
              <span className="text-sm">{translate("直播捉单（需应用审核）", "Live Order Capture (requires app review)")}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
