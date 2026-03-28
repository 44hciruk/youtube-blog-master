interface Article {
  id: number;
  title: string;
  sourceVideoUrl: string;
  wordCount: number | null;
  status: 'draft' | 'completed' | null;
  generatedAt: Date | string | null;
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
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">まだ記事がありません</p>
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
            <tr className="border-b border-gray-200 text-left text-gray-600">
              <th className="py-3 px-4 font-medium">タイトル</th>
              <th className="py-3 px-4 font-medium">生成日時</th>
              <th className="py-3 px-4 font-medium text-right">文字数</th>
              <th className="py-3 px-4 font-medium">ステータス</th>
              <th className="py-3 px-4 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <button
                    onClick={() => onEdit(article.id)}
                    className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                  >
                    {article.title}
                  </button>
                </td>
                <td className="py-3 px-4 text-gray-500">
                  {article.generatedAt
                    ? new Date(article.generatedAt).toLocaleDateString('ja-JP')
                    : '-'}
                </td>
                <td className="py-3 px-4 text-right text-gray-500">
                  {article.wordCount?.toLocaleString() || '-'}
                </td>
                <td className="py-3 px-4">
                  <StatusBadge status={article.status} />
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
      <div className="md:hidden space-y-3">
        {articles.map((article) => (
          <div key={article.id} className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between gap-2 mb-2">
              <button
                onClick={() => onEdit(article.id)}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 text-left leading-snug"
              >
                {article.title}
              </button>
              <StatusBadge status={article.status} />
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
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

function StatusBadge({ status }: { status: 'draft' | 'completed' | null }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
        status === 'completed'
          ? 'bg-green-100 text-green-700'
          : 'bg-yellow-100 text-yellow-700'
      }`}
    >
      {status === 'completed' ? '完成' : '下書き'}
    </span>
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
    <div className="flex gap-1 flex-wrap">
      <button
        onClick={() => onEdit(article.id)}
        className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
      >
        編集
      </button>
      <button
        onClick={() => onExport(article.id, 'markdown')}
        className="px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded hover:bg-gray-100"
      >
        MD
      </button>
      <button
        onClick={() => onExport(article.id, 'wordpress')}
        className="px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded hover:bg-gray-100"
      >
        WP
      </button>
      <button
        onClick={() => onDelete(article.id)}
        className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
      >
        削除
      </button>
    </div>
  );
}
