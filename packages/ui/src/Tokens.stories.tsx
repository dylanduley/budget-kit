import type { Meta, StoryObj } from '@storybook/react-vite';

import { contrastPairs } from './tokens.pairs';

const meta = {
  title: 'Foundations/Tokens',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ContrastPairs: Story = {
  render: () => (
    <table style={{ borderCollapse: 'collapse', font: 'var(--bk-font-size-sm) var(--bk-font-sans)' }}>
      <caption style={{ textAlign: 'left', paddingBottom: 'var(--bk-space-3)', color: 'var(--bk-color-text)' }}>
        Text and background pairs components may use. Each is checked against its minimum in tokens.test.ts.
      </caption>
      <thead>
        <tr style={{ textAlign: 'left', color: 'var(--bk-color-text)' }}>
          <th scope="col" style={{ padding: 'var(--bk-space-2)' }}>Sample</th>
          <th scope="col" style={{ padding: 'var(--bk-space-2)' }}>Text</th>
          <th scope="col" style={{ padding: 'var(--bk-space-2)' }}>Background</th>
          <th scope="col" style={{ padding: 'var(--bk-space-2)' }}>Minimum</th>
        </tr>
      </thead>
      <tbody>
        {contrastPairs.map(({ text, background, min }) => (
          <tr key={`${text} ${background}`} style={{ color: 'var(--bk-color-text)' }}>
            <td style={{ padding: 'var(--bk-space-2)' }}>
              {min === 3 ? (
                <span
                  style={{
                    display: 'block',
                    padding: 'var(--bk-space-2) var(--bk-space-3)',
                    background: `var(${background})`,
                    border: `2px solid var(${text})`,
                    borderRadius: 'var(--bk-radius-md)',
                  }}
                >
                  Outline
                </span>
              ) : (
                <span
                  style={{
                    display: 'block',
                    padding: 'var(--bk-space-2) var(--bk-space-3)',
                    color: `var(${text})`,
                    background: `var(${background})`,
                    border: '1px solid var(--bk-color-border)',
                    borderRadius: 'var(--bk-radius-md)',
                  }}
                >
                  $1,234.56 left
                </span>
              )}
            </td>
            <td style={{ padding: 'var(--bk-space-2)' }}><code>{text}</code></td>
            <td style={{ padding: 'var(--bk-space-2)' }}><code>{background}</code></td>
            <td style={{ padding: 'var(--bk-space-2)' }}>{min}:1</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};
