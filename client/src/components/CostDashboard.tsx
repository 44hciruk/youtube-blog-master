import { useState } from 'react';
import { trpc } from '../lib/trpc';

export function CostDashboard() {
  const [daysBack, setDaysBack] = useState(30);
  const [showArticleBreakdown, setShowArticleBreakdown] = useState(false);

  const usageQuery = trpc.usage.summary.useQuery({ daysBack });

  if (usageQuery.isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="text-center py-4 text-gray-400 text-sm">コスト情報を読み込み中...</div>
      </div>
    );
  }

  if (usageQuery.error) {
    return null; // Silently fail - cost dashboard is optional
  }

  const data = usageQuery.data;
  if (!data) return null;

  const totalCost = data.totalLlmCost + data.totalImageCost;
  const hasData = data.totalLlmCalls > 0 || data.totalImageCalls > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">コスト概算</h2>
        <select
          value={daysBack}
          onChange={(e) => setDaysBack(Number(e.target.value))}
          className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-600"
        >
          <option value={7}>過去7日</option>
          <option value={30}>過去30日</option>
          <option value={90}>過去90日</option>
        </select>
      </div>

      {!hasData ? (
        <p className="text-sm text-gray-400 text-center py-4">使用履歴はまだありません</p>
      ) : (
        <>
          {/* Estimated data notice */}
          {(data as Record<string, unknown>).isEstimated && (
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              ※ 記事データからの概算値です。今後の生成分から正確な使用量が記録されます。
            </div>
          )}
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-blue-500 mb-1">記事生成（LLM）</p>
              <p className="text-lg font-bold text-blue-700">{data.totalLlmCalls}回</p>
              <p className="text-xs text-blue-500">${data.totalLlmCost.toFixed(3)}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-purple-500 mb-1">画像生成</p>
              <p className="text-lg font-bold text-purple-700">{data.totalImageCalls}枚</p>
              <p className="text-xs text-purple-500">${data.totalImageCost.toFixed(3)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-green-500 mb-1">合計コスト</p>
              <p className="text-lg font-bold text-green-700">${totalCost.toFixed(3)}</p>
              <p className="text-xs text-green-500">約¥{Math.round(totalCost * 150)}</p>
            </div>
          </div>

          {/* Daily breakdown (last 7 days max) */}
          {data.dailyBreakdown.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-600 mb-2">日別推移</p>
              <div className="space-y-1">
                {data.dailyBreakdown.slice(0, 7).map((day) => (
                  <div key={day.date} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 w-24">{day.date}</span>
                    <div className="flex gap-3 text-gray-600">
                      <span>LLM {day.llmCalls}回</span>
                      <span>画像 {day.imageCalls}枚</span>
                      <span className="font-medium">${(day.llmCost + day.imageCost).toFixed(3)}</span>
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
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                <svg className={`w-3 h-3 transition-transform ${showArticleBreakdown ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                記事別内訳
              </button>
              {showArticleBreakdown && (
                <div className="mt-2 space-y-1">
                  {data.articleBreakdown.map((a) => (
                    <div key={a.articleId} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
                      <span className="text-gray-600 truncate max-w-[60%]">{a.articleTitle}</span>
                      <div className="flex gap-2 text-gray-500 flex-shrink-0">
                        <span>LLM {a.llmCalls}</span>
                        <span>画像 {a.imageCalls}</span>
                        <span className="font-medium text-gray-700">${a.totalCost.toFixed(3)}</span>
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
