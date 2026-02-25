import { useCallback, useState } from 'react';
import { Building2, FileText, Loader2, Package, Upload, Users } from 'lucide-react';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatFaNum } from '@/lib/numbers';
import { apiPost } from '@/lib/api';

type ImportType = 'contacts' | 'companies' | 'products';

type ContactsRow = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  email?: string;
};

type CompaniesRow = {
  name?: string;
  phone?: string;
  website?: string;
};

type ProductsRow = {
  code?: string;
  name?: string;
  unit?: string;
  basePrice?: string;
  category?: string;
  isActive?: string;
};

type ImportResult = {
  created: number;
  updated?: number;
  rejected?: Array<{ row: number; reason: string }>;
};

type ParsedRow = Record<string, string>;

const CONTACTS_HEADERS = 'firstName,lastName,phone,email';
const COMPANIES_HEADERS = 'name,phone,website';
const PRODUCTS_HEADERS = 'code,name,unit,basePrice,category,isActive';

function parseCsv(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/).filter((line) => line.trim());
  return lines.map((line) => {
    const row: string[] = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if ((ch === ',' && !inQuotes) || ch === '\t') {
        row.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    row.push(cell.trim());
    return row;
  });
}

function parseContactsCsv(text: string): ContactsRow[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.toLowerCase().replace(/\s/g, ''));
  const firstIdx = header.findIndex((h) => h === 'firstname' || h === 'name');
  const lastIdx = header.findIndex((h) => h === 'lastname');
  const fullIdx = header.findIndex((h) => h === 'fullname');
  const phoneIdx = header.findIndex((h) => h === 'phone' || h === 'mobile' || h === 'tel');
  const emailIdx = header.findIndex((h) => h === 'email');

  return rows.slice(1).map((row) => ({
    firstName: firstIdx >= 0 ? row[firstIdx] : undefined,
    lastName: lastIdx >= 0 ? row[lastIdx] : undefined,
    fullName: fullIdx >= 0 ? row[fullIdx] : undefined,
    phone: phoneIdx >= 0 ? row[phoneIdx] : undefined,
    email: emailIdx >= 0 ? row[emailIdx] : undefined,
  }));
}

function parseCompaniesCsv(text: string): CompaniesRow[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.toLowerCase().replace(/\s/g, ''));
  const nameIdx = header.findIndex((h) => h === 'name');
  const phoneIdx = header.findIndex((h) => h === 'phone' || h === 'mobile' || h === 'tel');
  const webIdx = header.findIndex((h) => h === 'website' || h === 'site');

  return rows.slice(1).map((row) => ({
    name: nameIdx >= 0 ? row[nameIdx] : row[0],
    phone: phoneIdx >= 0 ? row[phoneIdx] : row[1],
    website: webIdx >= 0 ? row[webIdx] : row[2],
  }));
}

function parseProductsCsv(text: string): ProductsRow[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.toLowerCase().replace(/\s/g, ''));
  const codeIdx = header.findIndex((h) => h === 'code' || h === 'sku');
  const nameIdx = header.findIndex((h) => h === 'name' || h === 'title');
  const unitIdx = header.findIndex((h) => h === 'unit');
  const priceIdx = header.findIndex((h) => h === 'baseprice' || h === 'price');
  const categoryIdx = header.findIndex((h) => h === 'category');
  const activeIdx = header.findIndex((h) => h === 'isactive' || h === 'active');

  return rows.slice(1).map((row) => ({
    code: codeIdx >= 0 ? row[codeIdx] : '',
    name: nameIdx >= 0 ? row[nameIdx] : row[0],
    unit: unitIdx >= 0 ? row[unitIdx] : row[2],
    basePrice: priceIdx >= 0 ? row[priceIdx] : row[3],
    category: categoryIdx >= 0 ? row[categoryIdx] : row[4],
    isActive: activeIdx >= 0 ? row[activeIdx] : row[5],
  }));
}

export default function ImportPage() {
  const [type, setType] = useState<ImportType>('contacts');
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files?.[0];
      setFile(selected ?? null);
      setParsed(null);
      setError(null);
      setResult(null);
      if (!selected) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result ?? '');
          if (type === 'contacts') setParsed(parseContactsCsv(text) as ParsedRow[]);
          else if (type === 'companies') setParsed(parseCompaniesCsv(text) as ParsedRow[]);
          else setParsed(parseProductsCsv(text) as ParsedRow[]);
        } catch {
          setError('فرمت CSV معتبر نیست.');
        }
      };
      reader.readAsText(selected, 'UTF-8');
    },
    [type],
  );

  const clearAndSwitchType = (nextType: ImportType) => {
    setType(nextType);
    setFile(null);
    setParsed(null);
    setError(null);
    setResult(null);
  };

  const downloadTemplate = () => {
    const headers =
      type === 'contacts' ? CONTACTS_HEADERS : type === 'companies' ? COMPANIES_HEADERS : PRODUCTS_HEADERS;
    const sample =
      type === 'contacts'
        ? 'Ali,Ahmadi,09120000001,ali@example.com'
        : type === 'companies'
          ? 'Sakhtar Co,02112345678,https://example.com'
          : 'CRM-ANNUAL,CRM Annual License,license,12000000,Subscription,true';
    const blob = new Blob([`\uFEFF${headers}\n${sample}\n`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download =
      type === 'contacts'
        ? 'contacts-template.csv'
        : type === 'companies'
          ? 'companies-template.csv'
          : 'products-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!parsed || parsed.length === 0) {
      setError('ابتدا یک فایل CSV معتبر انتخاب کنید.');
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);
    try {
      if (type === 'contacts') {
        const items = parsed.filter((row) => (row.firstName || row.lastName || row.fullName || '').trim());
        const res = await apiPost<{ created: number }>('/contacts/import', { items });
        setResult({ created: res.created });
      } else if (type === 'companies') {
        const items = parsed.filter((row) => (row.name || '').trim());
        const res = await apiPost<{ created: number }>('/companies/import', { items });
        setResult({ created: res.created });
      } else {
        const items = parsed.filter((row) => (row.name || '').trim());
        const res = await apiPost<ImportResult>('/products/import', { items });
        setResult(res);
      }
    } catch (unknownError: unknown) {
      setError(unknownError instanceof Error ? unknownError.message : 'خطا در ورود داده');
    } finally {
      setImporting(false);
    }
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
        <Alert className="rounded-card border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          <AlertDescription className="space-y-1">
            <p>ایجاد شد: {formatFaNum(result.created)}</p>
            {typeof result.updated === 'number' && <p>به‌روزرسانی شد: {formatFaNum(result.updated)}</p>}
            {result.rejected && result.rejected.length > 0 && (
              <p>رد شده: {formatFaNum(result.rejected.length)}</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="glass-card rounded-card p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={type === 'contacts' ? 'default' : 'outline'}
            onClick={() => clearAndSwitchType('contacts')}
          >
            <Users className="size-4 ml-1" />
            مخاطبین
          </Button>
          <Button
            type="button"
            size="sm"
            variant={type === 'companies' ? 'default' : 'outline'}
            onClick={() => clearAndSwitchType('companies')}
          >
            <Building2 className="size-4 ml-1" />
            شرکت‌ها
          </Button>
          <Button
            type="button"
            size="sm"
            variant={type === 'products' ? 'default' : 'outline'}
            onClick={() => clearAndSwitchType('products')}
          >
            <Package className="size-4 ml-1" />
            محصولات
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          {type === 'contacts' &&
            'CSV مخاطبین: firstName,lastName,phone,email (یا fullName برای نام کامل)'}
          {type === 'companies' && 'CSV شرکت‌ها: name,phone,website'}
          {type === 'products' && 'CSV محصولات: code,name,unit,basePrice,category,isActive'}
        </p>

        <div className="flex flex-wrap gap-2 items-center">
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
            <FileText className="size-4 ml-1" />
            دریافت قالب CSV
          </Button>
          <label className="cursor-pointer">
            <input type="file" accept=".csv,.txt" className="sr-only" onChange={handleFile} />
            <span className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted/40">
              <Upload className="size-4" />
              انتخاب فایل
            </span>
          </label>
        </div>

        {file && (
          <p className="text-sm text-muted-foreground fa-num">
            فایل: {file.name} - {formatFaNum(totalRows)} ردیف
          </p>
        )}

        {previewRows.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-[var(--bg-toolbar)]">
                    {Object.keys(previewRows[0]).map((header) => (
                      <th key={header} className="text-start p-2 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIndex) => (
                    <tr
                      key={`${rowIndex}-${Object.values(row).join('|')}`}
                      className="border-b border-[var(--border-default)] hover:bg-[var(--bg-muted)]"
                    >
                      {Object.values(row).map((value, colIndex) => (
                        <td key={`${rowIndex}-${colIndex}`} className="p-2">
                          {value || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalRows > 10 && (
              <p className="text-xs text-muted-foreground fa-num">
                نمایش 10 ردیف اول از {formatFaNum(totalRows)} ردیف
              </p>
            )}
            <Button type="button" onClick={handleImport} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="size-4 ml-2 animate-spin" />
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

