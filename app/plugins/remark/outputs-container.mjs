// Transform `:::outputs ... :::` into a <section class="code-outputs"> wrapper
// Requires remark-directive to be applied before this plugin

export default function remarkOutputsContainer() {
  return (tree) => {
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'containerDirective' && node.name === 'outputs') {
        node.data = node.data || {};
        node.data.hName = 'section';
        node.data.hProperties = { className: ['code-outputs'] };
      }

      const children = Array.isArray(node.children) ? node.children : [];
      for (const child of children) visit(child);
    };

    visit(tree);
  };
}


