import React from 'react';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

/**
 * Simple markdown renderer for AI-generated summaries
 * Supports: **bold**, *italic*, # headers, - lists, links
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    const renderMarkdown = (text: string): React.ReactNode[] => {
        const lines = text.split('\n');
        const elements: React.ReactNode[] = [];
        let listItems: string[] = [];
        let inList = false;

        const processInlineMarkdown = (line: string): React.ReactNode => {
            // Convert **bold** 
            line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

            // Convert *italic*
            line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');

            // Convert [link](url)
            line = line.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');

            // Convert `code`
            line = line.replace(/`(.*?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

            return <span dangerouslySetInnerHTML={{ __html: line }} />;
        };

        const flushList = () => {
            if (listItems.length > 0) {
                elements.push(
                    <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-3 ml-4">
                        {listItems.map((item, idx) => (
                            <li key={idx} className="text-gray-800 dark:text-gray-200">
                                {processInlineMarkdown(item)}
                            </li>
                        ))}
                    </ul>
                );
                listItems = [];
                inList = false;
            }
        };

        lines.forEach((line, index) => {
            const trimmed = line.trim();

            // Skip empty lines
            if (!trimmed) {
                if (inList) flushList();
                elements.push(<div key={`empty-${index}`} className="h-3" />);
                return;
            }

            // Headers (# ## ###)
            const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
            if (headerMatch) {
                if (inList) flushList();
                const level = headerMatch[1].length;
                const text = headerMatch[2];
                const sizes = ['text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm'];
                const className = `${sizes[level - 1]} font-bold text-gray-900 dark:text-white my-4`;

                // Use React.createElement to avoid TypeScript JSX errors
                if (level === 1) elements.push(<h1 key={`header-${index}`} className={className}>{processInlineMarkdown(text)}</h1>);
                else if (level === 2) elements.push(<h2 key={`header-${index}`} className={className}>{processInlineMarkdown(text)}</h2>);
                else if (level === 3) elements.push(<h3 key={`header-${index}`} className={className}>{processInlineMarkdown(text)}</h3>);
                else if (level === 4) elements.push(<h4 key={`header-${index}`} className={className}>{processInlineMarkdown(text)}</h4>);
                else if (level === 5) elements.push(<h5 key={`header-${index}`} className={className}>{processInlineMarkdown(text)}</h5>);
                else elements.push(<h6 key={`header-${index}`} className={className}>{processInlineMarkdown(text)}</h6>);

                return;
            }

            // List items (- or *)
            if (trimmed.match(/^[-*]\s+(.+)$/)) {
                const item = trimmed.substring(2).trim();
                listItems.push(item);
                inList = true;
                return;
            }

            // Flush list if we hit non-list content
            if (inList) flushList();

            // Regular paragraph
            elements.push(
                <p key={`para-${index}`} className="text-gray-800 dark:text-gray-200 leading-relaxed my-2">
                    {processInlineMarkdown(trimmed)}
                </p>
            );
        });

        // Flush any remaining list
        if (inList) flushList();

        return elements;
    };

    return (
        <div className={`markdown-content ${className}`}>
            {renderMarkdown(content)}
        </div>
    );
}
