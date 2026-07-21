import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search, Eye, GitMerge, AlertTriangle } from "lucide-react";

export default function Customers() {
  const [search, setSearch] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<any>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const utils = trpc.useUtils();

  const { data: customers, isLoading } = trpc.customers.list.useQuery({
    search: search || undefined,
  });

  const { data: mergeSuggestions } = trpc.customers.getMergeSuggestions.useQuery({ status: "pending" });

  // Duplicates are fetched reactively when detailCustomer changes
  const { data: duplicatesData } = trpc.customers.findDuplicates.useQuery(
    { customerId: detailCustomer?.id ?? 0 },
    { enabled: !!detailCustomer }
  );

  useEffect(() => {
    setDuplicates(duplicatesData ?? []);
  }, [duplicatesData]);

  const mergeMutation = trpc.customers.merge.useMutation({
    onSuccess: () => {
      utils.customers.invalidate();
      toast.success("客户档案已合并");
      setMergeOpen(false);
      setDetailOpen(false);
    },
    onError: (e) => toast.error(`合并失败: ${e.message}`),
  });

  function openDetail(customer: any) {
    setDuplicates([]);
    setDetailCustomer(customer);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">客户管理</h1>
        <p className="text-sm text-muted-foreground mt-1">
          统一客户档案，支持多维度身份识别与合并
        </p>
      </div>

      {/* Merge suggestions alert */}
      {mergeSuggestions && mergeSuggestions.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">发现 {mergeSuggestions.length} 个疑似重复客户待确认</p>
              <p className="text-xs text-muted-foreground">请检查并确认是否需要合并客户档案</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索客户名称、电话、Facebook..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>客户姓名</TableHead>
                <TableHead>Facebook 名称</TableHead>
                <TableHead>电话号码</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>订单数</TableHead>
                <TableHead>消费总额</TableHead>
                <TableHead>会员等级</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : customers?.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">暂无客户</TableCell></TableRow>
              ) : customers?.filter(c => !c.mergedIntoCustomerId).map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name || "-"}</TableCell>
                  <TableCell>{c.facebookName || "-"}</TableCell>
                  <TableCell className="text-sm">{c.phoneNumber || "-"}</TableCell>
                  <TableCell className="text-sm">{c.email || "-"}</TableCell>
                  <TableCell>{c.totalOrders}</TableCell>
                  <TableCell>RM {c.totalSpent}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {c.membershipLevel === "regular" ? "普通" : c.membershipLevel === "member" ? "会员" : "VIP"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.isBlacklisted ? (
                      <Badge variant="destructive">黑名单</Badge>
                    ) : (
                      <Badge variant="default">正常</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openDetail(c)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Customer detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>客户详情</DialogTitle>
          </DialogHeader>
          {detailCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm p-4 border rounded-lg">
                <div>
                  <p className="text-muted-foreground">姓名</p>
                  <p className="font-medium">{detailCustomer.name || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Facebook 名称</p>
                  <p className="font-medium">{detailCustomer.facebookName || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Facebook ID</p>
                  <p className="font-mono text-xs">{detailCustomer.facebookId || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Messenger ID</p>
                  <p className="font-mono text-xs">{detailCustomer.messengerId || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">电话号码</p>
                  <p className="font-medium">{detailCustomer.phoneNumber || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{detailCustomer.email || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">订单总数</p>
                  <p className="font-medium">{detailCustomer.totalOrders}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">消费总额</p>
                  <p className="font-bold">RM {detailCustomer.totalSpent}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">会员等级</p>
                  <Badge variant="outline">
                    {detailCustomer.membershipLevel === "regular" ? "普通" : detailCustomer.membershipLevel === "member" ? "会员" : "VIP"}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">积分余额</p>
                  <p className="font-medium">{detailCustomer.pointsBalance}</p>
                </div>
              </div>

              {/* Duplicates section */}
              {duplicates.length > 0 && (
                <div className="p-4 border border-orange-200 rounded-lg bg-orange-50/50 dark:bg-orange-950/20">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <p className="font-medium text-sm">发现疑似相同客户，是否合并？</p>
                  </div>
                  <div className="space-y-2">
                    {duplicates.map(d => (
                      <div key={d.id} className="flex items-center justify-between p-3 bg-white dark:bg-card rounded-lg border">
                        <div className="text-sm">
                          <p className="font-medium">{d.name || d.facebookName || `客户 #${d.id}`}</p>
                          <p className="text-xs text-muted-foreground">
                            {d.phoneNumber && `电话: ${d.phoneNumber} | `}
                            {d.facebookId && `FB ID: ${d.facebookId} | `}
                            {d.messengerId && `Messenger: ${d.messengerId}`}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => mergeMutation.mutate({
                            sourceId: d.id,
                            targetId: detailCustomer.id,
                          })}
                        >
                          <GitMerge className="h-4 w-4 mr-2" />
                          合并到此客户
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
