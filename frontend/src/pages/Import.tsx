/**
 * صفحهٔ ورود داده — آپلود CSV برای مخاطبین یا شرکت‌ها.
 */
import { useState, useCallback } from 'react';
import { Upload, FileText, Users, Building2, Loader2 } from 'lucide-react';
import { apiPost } from '@/lib/api';
import { formatFaNum } from '@/lib/numbers';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type ImportType = 'contacts' | 'companies';

const CONTACTS_HEADERS = 'firstName,lastName,phone,email';
const COMPANIES_HEADERS = 'name,phone,website';

function parseCsv(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
    const row: string[] = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if ((c === ',' && !inQuotes) || c === '\t') {
        row.push(cell.trim());
        cell = '';
      } else {
        cell += c;
      }
    }
    row.push(cell.trim());
    return row;
  });
}

function parseContactsCsv(text: string): Array<{ firstName?: string; lastName?: string; fullName?: string; phone?: string; email?: string }> {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.toLowerCase().replace(/\s/g, ''));
  const firstIdx = header.findIndex((h) => h === 'firstname' || h === 'نام');
  const lastIdx = header.findIndex((h) => h === 'lastname' || h === 'نامخانوادگی');
  const fullIdx = header.findIndex((h) => h === 'fullname' || h === 'name');
  const phoneIdx = header.findIndex((h) => h === 'phone' || h === 'tel' || h === 'موبایل');
  const emailIdx = header.findIndex((h) => h === 'email' || h === 'ایمیل');
  return rows.slice(1).map((row) => ({
    firstName: firstIdx >= 0 ? row[firstIdx] : undefined,
    lastName: lastIdx >= 0 ? row[lastIdx] : undefined,
    fullName: fullIdx >= 0 ? row[fullIdx] : (firstIdx < 0 && lastIdx < 0 ? row[0] : undefined),
    phone: phoneIdx >= 0 ? row[phoneIdx] : (firstIdx >= 0 ? row[2] : row[1]),
    email: emailIdx >= 0 ? row[emailIdx] : (firstIdx >= 0 ? row[3] : row[2]),
  }));
}

function parseCompaniesCsv(text: string): Array<{ name?: string; phone?: string; website?: string }> {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.toLowerCase().replace(/\s/g, ''));
  const nameIdx = header.findIndex((h) => h === 'name' || h === 'نام');
  const phoneIdx = header.findIndex((h) => h === 'phone' || h === 'tel');
  const webIdx = header.findIndex((h) => h === 'website' || h === 'site' || h === 'وب');
  return rows.slice(1).map((row) => ({
    name: nameIdx >= 0 ? row[nameIdx] : row[0],
    phone: phoneIdx >= 0 ? row[phoneIdx] : row[1],
    website: webIdx >= 0 ? row[webIdx] : row[2],
  }));
}

export default function ImportPage() {
  const [type, setType] = useState<ImportType>('contacts');
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<Array<Record<string, string>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number } | null>(null);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      setFile(f ?? null);
      setResult(null);
      setError(null);
      setParsed(null);
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? '');
        try {
          if (type === 'contacts') {
            const items = parseContactsCsv(text);
            setParsed(items as Array<Record<string, string>>);
          } else {
            const items = parseCompaniesCsv(text);
            setParsed(items as Array<Record<string, string>>);
          }
        } catch (err) {
          setError('فرمت CSV نامعتبر است.');
        }
      };
      reader.readAsText(f, 'UTF-8');
    },
    [type]
  );

  const handleImport = async () => {
    if (!parsed || parsed.length === 0) {
      setError('ابتدا یک فایل CSV انتخاب کنید.');
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const filtered =
        type === 'contacts'
          ? parsed.filter((r) => ((r.firstName ?? '').toString().trim()) || ((r.lastName ?? '').toString().trim()) || ((r.fullName ?? '').toString().trim()))
          : parsed.filter((r) => (r.name ?? '').toString().trim());
      if (filtered.length === 0) {
        setError('هیچ ردیف معتبری (با نام یا نام خانوادگی یا نام کامل) یافت نشد.');
        setImporting(false);
        return;
      }
      const endpoint = type === 'contacts' ? '/contacts/import' : '/companies/import';
      const body = type === 'contacts' ? { items: filtered } : { items: filtered };
      const res = await apiPost<{ created: number }>(endpoint, body);
      setResult({ created: res.created });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطا در ورود داده.');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = type === 'contacts' ? CONTACTS_HEADERS : COMPANIES_HEADERS;
    const sample = type === 'contacts'
      ? 'نام,نام خانوادگی,09121234567,sample@example.com'
      : 'نمونه شرکت,02112345678,https://example.com';
    const blob = new Blob([`\uFEFF${headers}\n${sample}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'contacts' ? 'contacts-template.csv' : 'companies-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewRows = parsed?.slice(0, 10) ?? [];
  const totalRows = parsed?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageBreadcrumb current="ورود داده" />
      <h1 className="text-title-lg font-title">ورود داده</h1>

      {error && (
        <Alert className="rounded-card border-destructive/30 bg-destructive/10 text-destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Alert className="rounded-card border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400">
          <AlertDescription>{result.created} ردیف با موفقیت وارد شد.</AlertDescription>
        </Alert>
      )}

      <div className="glass-card rounded-card p-6 space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <span className="text-sm font-medium text-muted-foreground">نوع داده:</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === 'contacts' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setType('contacts');
                setFile(null);
                setParsed(null);
                setResult(null);
              }}
            >
              <Users className="size-4 ml-1" aria-hidden />
              مخاطبین
            </Button>
            <Button
              type="button"
              variant={type === 'companies' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setType('companies');
                setFile(null);
                setParsed(null);
                setResult(null);
              }}
            >
              <Building2 className="size-4 ml-1" aria-hidden />
              شرکت‌ها
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          فایل CSV با سطر اول عنوان‌ها. برای مخاطبین: firstName, lastName, phone, email (یا fullName برای نام کامل) — برای شرکت‌ها: name, phone, website.
        </p>

        <div className="flex flex-wrap gap-2 items-center">
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
            <FileText className="size-4 ml-1" aria-hidden />
            دریافت قالب CSV
          </Button>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv,.txt"
              className="sr-only"
              onChange={handleFile}
            />
            <span className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted/40">
              <Upload className="size-4" aria-hidden />
              انتخاب فایل
            </span>
          </label>
        </div>

        {file && (
          <p className="text-sm text-muted-foreground fa-num">
            فایل: {file.name} — {formatFaNum(totalRows)} ردیف
          </p>
        )}

        {previewRows.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-[var(--bg-toolbar)]">
                    {Object.keys(previewRows[0]).map((k) => (
                      <th key={k} className="text-start p-2 font-medium">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-[var(--border-default)] hover:bg-[var(--bg-muted)]">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="p-2">
                          {v || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalRows > 10 && (
              <p className="text-xs text-muted-foreground fa-num">
                نمایش ۱۰ ردیف اول از {formatFaNum(totalRows)} ردیف.
              </p>
            )}
            <Button
              type="button"
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? (
                <>
                  <Loader2 className="size-4 ml-2 animate-spin" aria-hidden />
                  در حال ورود...
                </>
              ) : (
                `ورود ${formatFaNum(totalRows)} ردیف`
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
