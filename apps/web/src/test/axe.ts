import axe from 'axe-core';

export async function expectNoAxeViolations(root: Element = document.body): Promise<void> {
  // jsdom has no layout, so axe cannot measure contrast.
  const { violations } = await axe.run(root, { rules: { 'color-contrast': { enabled: false } } });
  if (violations.length > 0) {
    const summary = violations.map((v) => ({
      id: v.id,
      help: v.help,
      nodes: v.nodes.map((node) => node.html),
    }));
    throw new Error(`Expected no axe violations, found ${violations.length}:\n${JSON.stringify(summary, null, 2)}`);
  }
}
