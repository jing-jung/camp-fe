"use client";

import { useSearchParams } from "next/navigation";
import { AuthCallbackClient } from "@/components/AuthCallbackClient";

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  return <AuthCallbackClient code={code} state={state} />;
}
