// Copyright (c) 2026 MeeJoy

import { DataView } from "@/components/data-view"
import transactionsConfig from "@/configs/transactionsConfig.jsx"

export default function FinanceView() {
  return <DataView config={transactionsConfig} />
}
