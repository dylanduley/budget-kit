import { composeStories } from '@storybook/react-vite';
import axe from 'axe-core';

type StoryModule = Parameters<typeof composeStories>[0];

interface RunnableStory {
  run: () => Promise<void>;
}

const modules = import.meta.glob<StoryModule>('./**/*.stories.tsx', { eager: true });

const stories = Object.entries(modules).flatMap(([file, module]) =>
  Object.entries<RunnableStory>(composeStories(module)).map(([name, Story]) => ({
    id: `${file.replace(/^\.\//, '').replace(/\.stories\.tsx$/, '')} › ${name}`,
    Story,
  })),
);

describe('accessibility: every story', () => {
  it('finds stories to check', () => {
    expect(stories.length).toBeGreaterThan(0);
  });

  it.each(stories)('$id has no axe violations', async ({ Story }) => {
    await Story.run();

    const { violations } = await axe.run(document.body, {
      // jsdom has no layout or canvas, so axe can't measure contrast; tokens.test.ts covers it.
      // Stories render fragments, not pages, so the landmark rule doesn't apply.
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });

    expect(
      violations.map(({ id, help, nodes }) => ({ id, help, nodes: nodes.map((node) => node.html) })),
    ).toEqual([]);
  });
});
