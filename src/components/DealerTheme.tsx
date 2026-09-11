import { ConfigProvider } from 'antd';
import type { ReactNode } from 'react';
import { BRAND } from '../brand';

/**
 * The dealer portal's theme. Separate from the admin's on purpose: a back office stays
 * neutral so the data is loudest, while this side is a storefront and carries the brand.
 */
export default function DealerTheme({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: BRAND.amber,
          colorLink: BRAND.amberDeep,
          borderRadius: 8,
          fontSize: 14,
        },
        components: {
          // Amber is bright; white on it fails contrast. Ink text keeps buttons legible
          // and looks deliberate rather than washed out.
          Button: { primaryColor: BRAND.ink, defaultBorderColor: '#d5dbe2' },
          Input: { activeBorderColor: BRAND.amber, hoverBorderColor: BRAND.amber },
          InputNumber: { activeBorderColor: BRAND.amber, hoverBorderColor: BRAND.amber },
          Select: { optionSelectedBg: 'rgba(232, 163, 61, 0.14)' },
          Tree: {
            nodeSelectedBg: 'rgba(232, 163, 61, 0.18)',
            nodeHoverBg: 'rgba(15, 23, 42, 0.04)',
          },
          Card: { borderRadiusLG: 10 },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
