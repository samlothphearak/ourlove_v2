"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import PartnerInvitePage from "../../../components/auth/PartnerInvitePage";

function InvitePageContent() {
  const { code } = useParams<{ code: string }>();
  return <PartnerInvitePage code={code} />;
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <main
          aria-busy="true"
          className="flex min-h-screen items-center justify-center bg-[#09090f] px-4 text-sm text-gray-400"
        >
          Loading invitation...
        </main>
      }
    >
      <InvitePageContent />
    </Suspense>
  );
}
