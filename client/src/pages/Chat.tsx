import { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare, Send, Bot, User, Phone, Facebook,
  ShoppingBag, AlertCircle, CheckCircle2, Clock, Zap, Search,
  Package, MapPin, CreditCard, FileText, ArrowRight
} from "lucide-react";
import { Link, useLocation } from "wouter";

type ConversationFilter = "all" | "unread" | "messenger" | "whatsapp" | "needsHuman" | "aiDisabled" | "hasOrder";

export default function Chat() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [search, setSearch] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Parse URL param ?conv=ID to auto-select conversation
  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1] || "");
    const convId = params.get("conv");
    if (convId) {
      const id = parseInt(convId, 10);
      if (!isNaN(id)) setSelectedConvId(id);
    }
  }, [location]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Build query input from filter
  const queryInput = useMemo(() => {
    const input: any = { limit: 100 };
    if (filter === "unread") input.unreadOnly = true;
    else if (filter === "messenger") input.platform = "messenger";
    else if (filter === "whatsapp") input.platform = "whatsapp";
    else if (filter === "needsHuman") input.needsHuman = true;
    else if (filter === "aiDisabled") input.aiDisabled = true;
    if (searchDebounced) input.search = searchDebounced;
    return input;
  }, [filter, searchDebounced]);

  const { data: conversations, isLoading: convsLoading } = trpc.chat.listConversations.useQuery(queryInput);
  const { data: messages } = trpc.chat.getMessages.useQuery(
    { conversationId: selectedConvId || 0 },
    { enabled: !!selectedConvId }
  );

  const selectedConv = conversations?.find((c: any) => c.id === selectedConvId);

  const { data: customerInfo } = trpc.chat.getCustomerInfo.useQuery(
    { customerId: selectedConv?.customerId || 0 },
    { enabled: !!selectedConv?.customerId }
  );

  const sendMessageMut = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setMessageInput("");
    },
  });

  const markReadMut = trpc.chat.markRead.useMutation();
  const toggleAIMut = trpc.chat.toggleAI.useMutation();
  const handoverMut = trpc.chat.handover.useMutation();
  const resumeAIMut = trpc.chat.resumeAI.useMutation();

  // Mark as read when selecting a conversation
  useEffect(() => {
    if (selectedConvId && selectedConv?.unreadCount > 0) {
      markReadMut.mutate({ conversationId: selectedConvId });
    }
  }, [selectedConvId, selectedConv?.unreadCount]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!messageInput.trim() || !selectedConvId) return;
    sendMessageMut.mutate({
      conversationId: selectedConvId,
      content: messageInput.trim(),
    });
  };

  const handleToggleAI = (enabled: boolean) => {
    if (!selectedConvId) return;
    toggleAIMut.mutate({ conversationId: selectedConvId, enabled });
  };

  const handleHandover = () => {
    if (!selectedConvId) return;
    handoverMut.mutate({ conversationId: selectedConvId });
  };

  const handleResumeAI = () => {
    if (!selectedConvId) return;
    resumeAIMut.mutate({ conversationId: selectedConvId });
  };

  const getSenderIcon = (senderType: string) => {
    switch (senderType) {
      case "customer": return <User className="h-4 w-4" />;
      case "ai": return <Bot className="h-4 w-4" />;
      case "staff": return <User className="h-4 w-4" />;
      case "system": return <AlertCircle className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getPlatformIcon = (platform: string) => {
    return platform === "messenger" ? <Facebook className="h-3 w-3" /> : <Phone className="h-3 w-3" />;
  };

  const getPlatformLabel = (platform: string) => {
    return platform === "messenger" ? "Messenger" : "WhatsApp";
  };

  const formatTime = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin}分钟前`;
    if (diffHour < 24) return `${diffHour}小时前`;
    if (diffDay < 7) return `${diffDay}天前`;
    return d.toLocaleDateString("zh-CN");
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left Column — Conversation List */}
      <div className="w-80 border-r flex flex-col shrink-0">
        <div className="p-3 border-b space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            客服对话
          </h2>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索客户/电话/Messenger ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as ConversationFilter)}>
            <TabsList className="grid grid-cols-4 h-8 text-xs">
              <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
              <TabsTrigger value="unread" className="text-xs">未读</TabsTrigger>
              <TabsTrigger value="needsHuman" className="text-xs">人工</TabsTrigger>
              <TabsTrigger value="aiDisabled" className="text-xs">AI关</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1" ref={scrollAreaRef as any}>
          {convsLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">加载中...</div>
          ) : !conversations || conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">暂无对话</div>
          ) : (
            <div className="divide-y">
              {conversations.map((conv: any) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedConvId === conv.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs">
                        {(conv.customerName || conv.facebookName || conv.platformId || "?").charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">
                          {conv.customerName || conv.facebookName || conv.platformId || "未知客户"}
                        </span>
                        {getPlatformIcon(conv.platform)}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conv.lastMessagePreview || "(无消息)"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {conv.lastMessageAt ? formatTime(conv.lastMessageAt) : ""}
                        </span>
                        {conv.unreadCount > 0 && (
                          <Badge variant="destructive" className="text-[10px] h-4 px-1">
                            {conv.unreadCount}
                          </Badge>
                        )}
                        {conv.handoverStatus === "pending" && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-orange-100 text-orange-700">
                            需人工
                          </Badge>
                        )}
                        {!conv.aiReplyEnabled && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            AI关
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Middle Column — Chat Messages */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConv ? (
          <>
            <div className="p-3 border-b flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {(selectedConv.customerName || selectedConv.facebookName || selectedConv.platformId || "?").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {selectedConv.customerName || selectedConv.facebookName || selectedConv.platformId || "未知客户"}
                  </span>
                  {getPlatformIcon(selectedConv.platform)}
                  <span className="text-xs text-muted-foreground">{getPlatformLabel(selectedConv.platform)}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {selectedConv.handoverStatus === "pending" && (
                    <Badge variant="secondary" className="text-[10px] h-4 bg-orange-100 text-orange-700">
                      等待人工接手
                    </Badge>
                  )}
                  {selectedConv.handoverStatus === "claimed" && (
                    <Badge variant="secondary" className="text-[10px] h-4 bg-green-100 text-green-700">
                      已接手: {selectedConv.handoverClaimedBy}
                    </Badge>
                  )}
                  {selectedConv.aiToggledBy && (
                    <span className="text-[10px] text-muted-foreground">
                      AI由{selectedConv.aiToggledBy}于{selectedConv.aiToggledAt ? new Date(selectedConv.aiToggledAt).toLocaleString("zh-CN") : ""}切换
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <Switch
                    checked={selectedConv.aiReplyEnabled}
                    onCheckedChange={handleToggleAI}
                    disabled={toggleAIMut.isPending}
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedConv.aiReplyEnabled ? "AI开" : "AI关"}
                  </span>
                </div>
                {selectedConv.handoverStatus === "pending" && (
                  <Button size="sm" variant="default" onClick={handleHandover} disabled={handoverMut.isPending}>
                    人工接手
                  </Button>
                )}
                {selectedConv.handoverStatus === "claimed" && (
                  <Button size="sm" variant="outline" onClick={handleResumeAI} disabled={resumeAIMut.isPending}>
                    <Bot className="h-3 w-3 mr-1" /> 恢复AI
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {!messages || messages.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">暂无消息记录</div>
                ) : (
                  messages.map((msg: any) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${msg.senderType === "customer" ? "justify-start" : "justify-end"}`}
                    >
                      {msg.senderType === "customer" && (
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="text-[10px]">
                            {(selectedConv.customerName || "C").charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`max-w-[70%] ${msg.senderType === "customer" ? "" : "items-end"}`}>
                        <div className={`flex items-center gap-1 mb-0.5 ${msg.senderType === "customer" ? "" : "justify-end"}`}>
                          <span className="text-[10px] text-muted-foreground">
                            {msg.senderType === "customer" ? "客户" :
                             msg.senderType === "ai" ? "AI" :
                             msg.senderType === "staff" ? msg.senderName || "工作人员" :
                             "系统"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(msg.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {msg.status === "failed" && (
                            <AlertCircle className="h-3 w-3 text-destructive" />
                          )}
                        </div>
                        <div
                          className={`rounded-lg px-3 py-2 text-sm ${
                            msg.senderType === "customer"
                              ? "bg-muted"
                              : msg.senderType === "ai"
                              ? "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                              : msg.senderType === "system"
                              ? "bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100 text-xs"
                              : "bg-primary text-primary-foreground"
                          }`}
                        >
                          {msg.messageType === "image" && msg.mediaUrl && (
                            <img src={msg.mediaUrl} alt="image" className="rounded mb-1 max-w-full" />
                          )}
                          {msg.content}
                        </div>
                      </div>
                      {msg.senderType !== "customer" && (
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="text-[10px]">
                            {msg.senderType === "ai" ? <Bot className="h-3 w-3" /> :
                             msg.senderType === "system" ? <AlertCircle className="h-3 w-3" /> :
                             <User className="h-3 w-3" />}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="p-3 border-t flex gap-2">
              <Input
                placeholder="输入消息..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={sendMessageMut.isPending}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!messageInput.trim() || sendMessageMut.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>选择左侧对话开始客服聊天</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Column — Customer Info */}
      <div className="w-72 border-l shrink-0 overflow-y-auto">
        {selectedConv ? (
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">客户资料</h3>
              {selectedConv.customerId ? (
                customerInfo ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">姓名</span>
                      <span className="font-medium">{customerInfo.name || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">电话</span>
                      <span>{customerInfo.phone || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">WhatsApp</span>
                      <span>{customerInfo.whatsappPhone || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">FB名称</span>
                      <span>{customerInfo.facebookName || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Messenger ID</span>
                      <span className="text-xs">{selectedConv.platformId || customerInfo.messengerId || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">客户类型</span>
                      <Badge variant="outline" className="text-xs">{customerInfo.customerType}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credit余额</span>
                      <span>RM {customerInfo.creditBalance || "0.00"}</span>
                    </div>
                    {customerInfo.shippingAddress && (
                      <div>
                        <span className="text-muted-foreground">收件地址</span>
                        <p className="mt-1 text-xs bg-muted rounded p-2">{customerInfo.shippingAddress}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">加载中...</p>
                )
              ) : (
                <p className="text-sm text-muted-foreground">未关联客户（仅平台ID: {selectedConv.platformId}）</p>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-semibold mb-2">最近订单</h3>
              {customerInfo?.recentOrders && customerInfo.recentOrders.length > 0 ? (
                <div className="space-y-2">
                  {customerInfo.recentOrders.map((order: any) => (
                    <Link key={order.id} href={`/orders/${order.id}`}>
                      <div className="p-2 rounded hover:bg-muted/50 cursor-pointer text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{order.orderNumber}</p>
                          <Badge variant="outline" className="text-xs">{order.customerStatus}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString("zh-CN")} · RM {order.totalAmount}
                        </p>
                        {order.specialOrderType && (
                          <Badge variant="secondary" className="text-[10px] h-4 bg-orange-100 text-orange-700">
                            {order.specialOrderType === "pending_shipping" ? "待补运费" :
                             order.specialOrderType === "pending_refund" ? "待退款" :
                             order.specialOrderType === "logistics_error" ? "物流异常" :
                             order.specialOrderType === "incomplete_info" ? "客户资料不完整" :
                             order.specialOrderType === "notification_failed" ? "自动通知失败" :
                             order.specialOrderType === "stock_exception" ? "库存异常" :
                             order.specialOrderType === "overdue" ? "超过24小时未处理" : order.specialOrderType}
                          </Badge>
                        )}
                        {order.remarks && order.remarks.length > 0 && (
                          <div className="space-y-0.5">
                            {order.remarks.map((r: any) => (
                              <div key={r.id} className="text-[10px] bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
                                {r.remarkCategory === "repotting" ? "🪴 换盆" :
                                 r.remarkCategory === "desired_delivery_date" ? "📅 希望收货日期" :
                                 "📝 " + (r.content || "其他")}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无订单</p>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="text-sm font-semibold mb-2">快捷操作</h3>
              <div className="space-y-1.5">
                {selectedConv.customerId && (
                  <Link href={`/orders/create?customerId=${selectedConv.customerId}`}>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <ShoppingBag className="h-4 w-4 mr-2" /> 建立订单
                    </Button>
                  </Link>
                )}
                {selectedConv.customerId && (
                  <Link href={`/customers?search=${selectedConv.customerId}`}>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <User className="h-4 w-4 mr-2" /> 查看客户
                    </Button>
                  </Link>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handleToggleAI(!selectedConv.aiReplyEnabled)}
                >
                  <Bot className="h-4 w-4 mr-2" />
                  {selectedConv.aiReplyEnabled ? "关闭AI回复" : "开启AI回复"}
                </Button>
                {selectedConv.handoverStatus !== "claimed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={handleHandover}
                  >
                    <User className="h-4 w-4 mr-2" /> 人工接手
                  </Button>
                )}
                {selectedConv.handoverStatus === "claimed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={handleResumeAI}
                  >
                    <Bot className="h-4 w-4 mr-2" /> 恢复AI回复
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">
            选择对话查看客户资料
          </div>
        )}
      </div>
    </div>
  );
}
