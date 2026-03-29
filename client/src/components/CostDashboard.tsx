import { useState } from 'react';
import { trpc } from '../lib/trpc';

export function CostDashboard() {
  const [daysBack, setDaysBack] = useState(30);
  const [showArticleBreakdown, setShowArticleBreakdown] = useState(false);

  const usageQuery = trpc.usage.summary.useQuery({ daysBack });

  if (usageQuery.isLoading) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
        <div className="text-center py-4 text-[#6B7280] text-sm">コスト情報を読み込み中...</div>
      </div>
    );
  }

  if (usageQuery.error) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
        <h2 className="text-sm font-semibold text-[#111827] mb-2">コスト概算</h2>
        <p className="text-sm text-[#6B7280] text-center py-4">コスト情報を取得できませんでした</p>
      </div>
    );
  }

  const data = usageQuery.data;
  if (!data) return null;

  const totalCost = data.totalLlmCost + data.totalImageCost;
  const hasData = data.totalLlmCalls > 0 || data.totalImageCalls > 0;
  const isEstimated = (data as Record<string, unknown>).isEstimated;

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[#111827]">コスト概算</h2>
        <select
          value={daysBack}
          onChange={(e) => setDaysBack(Number(e.target.value))}
          className="text-xs px-2 py-1 border border-[#E5E7EB] rounded-lg bg-white text-[#6B7280]"
        >
          <option value={7}>過去7日</option>
          <option value={30}>過去30日</option>
          <option value={90}>過去90日</option>
        </select>
      </div>

      {!hasData ? (
        <p className="text-sm text-[#6B7280] text-center py-4">使用履歴はまだありません</p>
      ) : (
        <>
          {/* Summary - 3 columns with border separators */}
          <div className="grid grid-cols-3 divide-x divide-[#E5E7EB] border border-[#E5E7EB] rounded-lg mb-4">
            <div className="p-3 sm:p-4 text-center">
              <p className="text-xs text-[#6B7280] mb-1">記事生成（LLM）</p>
              <p className="text-2xl font-semibold text-[#111827]">{data.totalLlmCalls}<span className="text-sm font-normal text-[#6B7280] ml-0.5">回</span></p>
              <p className="text-sm text-[#6B7280]">${data.totalLlmCost.toFixed(3)}</p>
            </div>
            <div className="p-3 sm:p-4 text-center">
              <p className="text-xs text-[#6B7280] mb-1">画像生成</p>
              <p className="text-2xl font-semibold text-[#111827]">{data.totalImageCalls}<span className="text-sm font-normal text-[#6B7280] ml-0.5">枚</span></p>
              <p className="text-sm text-[#6B7280]">${data.totalImageCost.toFixed(3)}</p>
            </div>
            <div className="p-3 sm:p-4 text-center">
              <p className="text-xs text-[#6B7280] mb-1">合計コスト</p>
              <p className="text-2xl font-semibold text-[#111827]">${totalCost.toFixed(3)}</p>
              <p className="text-sm text-[#6B7280]">約¥{Math.round(totalCost * 150)}</p>
            </div>
          </div>

          {/* Estimated notice - subtle inline text */}
          {isEstimated && (
            <p className="text-xs text-[#6B7280] mb-4">※ 記事データからの概算値です</p>
          )}

          {/* Daily breakdown */}
          {data.dailyBreakdown.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-[#6B7280] mb-2">日別推移</p>
              <div className="space-y-1">
                {data.dailyBreakdown.slice(0, 7).map((day) => (
                  <div key={day.date} className="flex items-center justify-between text-xs">
                    <span className="text-[#6B7280] w-24 font-mono">{day.date}</span>
                    <div className="flex gap-3 text-[#6B7280]">
                      <span>LLM {day.llmCalls}回</span>
                      <span>画像 {day.imageCalls}枚</span>
                      <span className="font-medium text-[#111827]">${(day.llmCost + day.imageCost).toFixed(3)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Article breakdown (collapsible) */}
          {data.articleBreakdown.length > 0 && (
            <div>
              <button
                onClick={() => setShowArticleBreakdown(!showArticleBreakdown)}
                className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#111827]"
              >
                <svg className={`w-3 h-3 transition-transform ${showArticleBreakdown ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                記事別内訳
              </button>
              {showArticleBreakdown && (
                <div className="mt-2 space-y-1">
                  {data.articleBreakdown.map((a) => (
                    <div key={a.articleId} className="flex items-center justify-between text-xs border-b border-[#E5E7EB] py-1.5 last:border-b-0">
                      <span className="text-[#374151] truncate max-w-[60%]">{a.articleTitle}</span>
                      <div className="flex gap-2 text-[#6B7280] flex-shrink-0">
                        <span>LLM {a.llmCalls}</span>
                        <span>画像 {a.imageCalls}</span>
                        <span className="font-medium text-[#111827]">${a.totalCost.toFixed(3)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
