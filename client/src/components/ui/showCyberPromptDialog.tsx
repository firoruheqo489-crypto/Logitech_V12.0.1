import { createRoot } from 'react-dom/client';
import CyberPromptDialog, { type CyberPromptField } from './CyberPromptDialog';

interface ShowCyberPromptDialogOptions {
  title: string;
  subtitle?: string;
  description?: string;
  fields: CyberPromptField[];
  confirmText?: string;
  cancelText?: string;
  tone?: 'cyan' | 'purple';
}

export function showCyberPromptDialog(
  options: ShowCyberPromptDialogOptions,
): Promise<Record<string, string> | null> {
  if (typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const root = createRoot(host);
    let settled = false;

    const close = (result: Record<string, string> | null) => {
      if (settled) return;
      settled = true;
      queueMicrotask(() => {
        root.unmount();
        host.remove();
      });
      resolve(result);
    };

    root.render(
      <CyberPromptDialog
        open
        title={options.title}
        subtitle={options.subtitle}
        description={options.description}
        fields={options.fields}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        tone={options.tone}
        onConfirm={(values) => close(values)}
        onCancel={() => close(null)}
      />,
    );
  });
}
