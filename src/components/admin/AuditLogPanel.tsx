import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { getAdminAuditLog } from "@/lib/admin.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function AuditLogPanel() {
  const log = useQuery({ queryKey: ["admin-audit-log"], queryFn: useServerFn(getAdminAuditLog) });
  const rows = log.data ?? [];

  return (
    <>
      <h2 className="mt-12 text-lg font-semibold">Admin audit log</h2>
      {!rows.length ? (
        <div className="surface mt-4 p-6 text-sm text-muted-foreground">No admin actions recorded yet.</div>
      ) : (
        <div className="surface mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">{row.actor}</TableCell>
                  <TableCell className="font-mono text-xs">{row.action}</TableCell>
                  <TableCell className="text-sm">{row.target}</TableCell>
                  <TableCell className="max-w-64 truncate font-mono text-xs text-muted-foreground">
                    {JSON.stringify(row.detail)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
