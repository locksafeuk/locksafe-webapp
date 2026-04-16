"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ReportRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/job/${id}/report`);
  }, [id, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
        <p className="text-slate-600">Redirecting to report...</p>
      </div>
    </div>
  );
}
