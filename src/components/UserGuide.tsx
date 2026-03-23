import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';

interface TocItem {
  id: string;
  title: string;
  level: number;
}

export default function UserGuide() {
  const navigate = useNavigate();
  const [content, setContent] = useState<string>('');
  const [toc, setToc] = useState<TocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tocExpanded, setTocExpanded] = useState(true);

  useEffect(() => {
    fetch('/docs/user-guide.md')
      .then((res) => res.text())
      .then((text) => {
        // Parse headings for table of contents
        const headings: TocItem[] = [];
        const lines = text.split('\n');
        lines.forEach((line) => {
          const match = line.match(/^(#{1,3})\s+(.+)/);
          if (match) {
            const level = match[1].length;
            const title = match[2];
            const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            headings.push({ id, title, level });
          }
        });
        setToc(headings);

        // Convert markdown to HTML (simple conversion)
        let html = text
          // Code blocks
          .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
          // Inline code
          .replace(/`([^`]+)`/g, '<code>$1</code>')
          // Images
          .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="/docs/$2" />')
          // Links
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
          // Headings with IDs
          .replace(/^### (.+)$/gm, (_, t) => `<h3 id="${t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}">${t}</h3>`)
          .replace(/^## (.+)$/gm, (_, t) => `<h2 id="${t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}">${t}</h2>`)
          .replace(/^# (.+)$/gm, (_, t) => `<h1 id="${t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}">${t}</h1>`)
          // Bold
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          // Italic
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
          // Tables
          .replace(/^\|(.+)\|$/gm, (match) => {
            const cells = match.split('|').filter(c => c.trim());
            if (cells.every(c => /^[-:]+$/.test(c.trim()))) {
              return ''; // Skip separator row
            }
            const isHeader = cells.some(c => c.includes('---'));
            const cellTag = isHeader ? 'th' : 'td';
            return `<tr>${cells.map(c => `<${cellTag}>${c.trim()}</${cellTag}>`).join('')}</tr>`;
          })
          // Blockquotes
          .replace(/^>\s*(.+)$/gm, '<blockquote>$1</blockquote>')
          // Horizontal rules
          .replace(/^---$/gm, '<hr />')
          // Unordered lists
          .replace(/^- (.+)$/gm, '<li>$1</li>')
          // Ordered lists
          .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
          // Paragraphs
          .replace(/\n\n/g, '</p><p>')
          // Line breaks
          .replace(/\n/g, '<br />');

        // Wrap in paragraph tags
        html = `<p>${html}</p>`;

        // Clean up multiple consecutive <br /> tags
        html = html.replace(/(<br \/>)+/g, '<br />');

        // Wrap consecutive <li> tags in <ul>
        html = html.replace(/(<li>.*?<\/li>(?:<br \/>)?)+/g, (match) => {
          const items = match.replace(/<br \/>/g, '');
          return `<ul>${items}</ul>`;
        });

        // Wrap consecutive <tr> tags in <table>
        html = html.replace(/(<tr>.*?<\/tr>(?:<br \/>)?)+/g, (match) => {
          const rows = match.replace(/<br \/>/g, '');
          return `<table>${rows}</table>`;
        });

        setContent(html);
        setLoading(false);
      })
      .catch(() => {
        setContent('<p>Could not load user guide.</p>');
        setLoading(false);
      });
  }, []);

  function scrollToSection(id: string) {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <div className="user-guide-page">
      <header className="user-guide-header">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="user-guide-title">
          <BookOpen size={20} />
          <h1>User Guide</h1>
        </div>
      </header>

      <div className="user-guide-layout">
        <aside className="user-guide-sidebar">
          <button className="toc-toggle" onClick={() => setTocExpanded(!tocExpanded)}>
            {tocExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Table of Contents
          </button>
          {tocExpanded && (
            <nav className="toc">
              {toc.filter(item => item.level <= 2).map((item) => (
                <button
                  key={item.id}
                  className={`toc-item toc-level-${item.level}`}
                  onClick={() => scrollToSection(item.id)}
                >
                  {item.title}
                </button>
              ))}
            </nav>
          )}
        </aside>

        <main className="user-guide-content">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="markdown-body" dangerouslySetInnerHTML={{ __html: content }} />
          )}
        </main>
      </div>
    </div>
  );
}
