import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Render markdown jawaban AI dengan gaya yang menyatu dengan tema (tanpa plugin typography). */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("grid gap-2 text-sm leading-relaxed break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h3 className="mt-1 text-base font-semibold" {...p} />,
          h2: (p) => <h3 className="mt-1 text-base font-semibold" {...p} />,
          h3: (p) => <h4 className="mt-1 font-semibold" {...p} />,
          p: (p) => <p {...p} />,
          ul: (p) => <ul className="grid list-disc gap-1 pl-5" {...p} />,
          ol: (p) => <ol className="grid list-decimal gap-1 pl-5" {...p} />,
          strong: (p) => <strong className="font-semibold" {...p} />,
          a: (p) => <a className="underline underline-offset-2" target="_blank" rel="noreferrer" {...p} />,
          code: (p) => <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]" {...p} />,
          table: (p) => (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs tabular-nums" {...p} />
            </div>
          ),
          th: (p) => <th className="border-b bg-muted px-2 py-1.5 text-left font-medium" {...p} />,
          td: (p) => <td className="border-b px-2 py-1.5 last:border-b-0" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
