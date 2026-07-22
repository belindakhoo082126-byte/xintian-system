import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, ArrowUp, ArrowDown, Trash2 } from "lucide-react";

export default function Couriers() {
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const utils = trpc.useUtils();

  const { data: couriers, isLoading } = trpc.couriers.list.useQuery();

  const createMutation = trpc.couriers.create.useMutation({
    onSuccess: () => {
      utils.couriers.invalidate();
      toast.success("快递公司已添加");
      setCreateOpen(false);
      setNewName("");
    },
    onError: (e) => toast.error(`添加失败: ${e.message}`),
  });

  const updateMutation = trpc.couriers.update.useMutation({
    onSuccess: () => {
      utils.couriers.invalidate();
      toast.success("已更新");
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  const deleteMutation = trpc.couriers.delete.useMutation({
    onSuccess: () => {
      utils.couriers.invalidate();
      toast.success("已停用");
    },
    onError: (e) => toast.error(`操作失败: ${e.message}`),
  });

  function handleCreate() {
    if (!newName.trim()) {
      toast.error("请输入快递公司名称");
      return;
    }
    createMutation.mutate({ name: newName.trim() });
  }

  function handleToggleActive(id: number, currentActive: boolean) {
    updateMutation.mutate({ id, isActive: !currentActive });
  }

  function handleMoveUp(id: number, currentOrder: number) {
    updateMutation.mutate({ id, sortOrder: currentOrder - 1 });
  }

  function handleMoveDown(id: number, currentOrder: number) {
    updateMutation.mutate({ id, sortOrder: currentOrder + 1 });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">快递公司管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理发货可选的快递公司</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />添加快递公司
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">排序</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">加载中...</TableCell></TableRow>
              ) : couriers?.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">暂无快递公司</TableCell></TableRow>
              ) : couriers?.map((c: any, idx: number) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        disabled={idx === 0}
                        onClick={() => handleMoveUp(c.id, c.sortOrder)}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        disabled={idx === (couriers?.length ?? 0) - 1}
                        onClick={() => handleMoveDown(c.id, c.sortOrder)}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? "default" : "secondary"}>
                      {c.isActive ? "启用" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm"
                      onClick={() => handleToggleActive(c.id, c.isActive)}>
                      {c.isActive ? "停用" : "启用"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加快递公司</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>快递公司名称</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="例如: PosLaju, J&T, ABX..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>确认添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
