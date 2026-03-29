interface Article {
  id: number;
  title: string;
  sourceVideoUrl: string;
  wordCount: number | null;
  status: 'draft' | 'completed' | null;
  generatedAt: Date | string | null;
  sourceVideoId?: string;
}

interface ArticleTableProps {
  articles: Article[];
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onExport: (id: number, format: 'markdown' | 'wordpress') => void;
}

export function ArticleTable({ articles, onEdit, onDelete, onExport }: ArticleTableProps) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-12 text-[#6B7280]">
        <p className="text-base">まだ記事がありません</p>
        <p className="text-sm mt-1">YouTube URLを入力して記事を生成しましょう</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-left text-[#6B7280]">
              <th className="py-2.5 px-4 font-medium text-xs">タイトル</th>
              <th className="py-2.5 px-4 font-medium text-xs">生成日時</th>
              <th className="py-2.5 px-4 font-medium text-xs text-right">文字数</th>
              <th className="py-2.5 px-4 font-medium text-xs text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id} className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onEdit(article.id)}
                      className="text-[#2563EB] hover:text-[#1D4ED8] hover:underline text-left text-sm"
                    >
                      {article.title}
                    </button>
                    {article.sourceVideoUrl && (
                      <a
                        href={article.sourceVideoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-[#6B7280] hover:text-[#EF4444] transition-colors"
                        title="元動画を開く"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
                          <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white"/>
                        </svg>
                      </a>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-[#6B7280] text-sm font-mono">
                  {article.generatedAt
                    ? new Date(article.generatedAt).toLocaleDateString('ja-JP')
                    : '-'}
                </td>
                <td className="py-3 px-4 text-right text-[#6B7280] text-sm font-mono">
                  {article.wordCount?.toLocaleString() || '-'}
                </td>
                <td className="py-3 px-4 text-right">
                  <ActionButtons article={article} onEdit={onEdit} onDelete={onDelete} onExport={onExport} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-2">
        {articles.map((article) => (
          <div key={article.id} className="border border-[#E5E7EB] rounded-lg p-3 bg-white">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onEdit(article.id)}
                  className="text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8] text-left leading-snug"
                >
                  {article.title}
                </button>
                {article.sourceVideoUrl && (
                  <a
                    href={article.sourceVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-[#6B7280] hover:text-[#EF4444] transition-colors"
                    title="元動画を開く"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
                      <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="white"/>
                    </svg>
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-2.5 font-mono">
              <span>
                {article.generatedAt
                  ? new Date(article.generatedAt).toLocaleDateString('ja-JP')
                  : '-'}
              </span>
              <span>{article.wordCount?.toLocaleString() || '-'}字</span>
            </div>
            <ActionButtons article={article} onEdit={onEdit} onDelete={onDelete} onExport={onExport} />
          </div>
        ))}
      </div>
    </>
  );
}

function ActionButtons({
  article,
  onEdit,
  onDelete,
  onExport,
}: {
  article: Article;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onExport: (id: number, format: 'markdown' | 'wordpress') => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button
        onClick={() => onExport(article.id, 'markdown')}
        className="px-2 py-1 text-xs text-[#6B7280] hover:bg-[#F3F4F6] rounded transition-colors"
      >
        MD
      </button>
      <button
        onClick={() => onExport(article.id, 'wordpress')}
        className="px-2 py-1 text-xs text-[#6B7280] hover:bg-[#F3F4F6] rounded transition-colors"
      >
        HTML
      </button>
      <button
        onClick={() => onDelete(article.id)}
        className="px-2 py-1 text-[13px] text-[#EF4444] bg-transparent border-none hover:underline transition-colors ml-auto"
      >
        削除
      </button>
    </div>
  );
}
