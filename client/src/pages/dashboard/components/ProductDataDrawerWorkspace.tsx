'use client';

import { PackageOpen } from 'lucide-react';
import type { ModuleTheme } from '@/lib/theme';
import type { ProjectData } from '../types/project';
import type { ProductModuleRecord } from '../types/product-module';
import { buildProductModuleLookupKey, normalizeMoldLookupKey } from '../lib/productModuleUtils';
import ProductDataWorkspace from './ProductDataWorkspace';
import AssetDrawerWorkspace, { type AssetPanelItem } from './AssetDrawerWorkspace';

interface ProductDataDrawerWorkspaceProps {
  panels: AssetPanelItem[];
  projects: ProjectData[];
  theme: ModuleTheme;
  productDataByMold: Record<string, ProductModuleRecord>;
  productSequenceByMold: Record<string, string>;
}

export default function ProductDataDrawerWorkspace({
  panels,
  projects,
  theme,
  productDataByMold,
  productSequenceByMold,
}: ProductDataDrawerWorkspaceProps) {
  return (
    <AssetDrawerWorkspace
      panels={panels}
      badgeLabel="Active Product Asset"
      drawerTitle="产品模块抽屉"
      drawerDescription="通过模具编号 + NO 双认证选择当前要查看的产品模块。"
      emptyMessage="暂无产品模块数据"
      icon={PackageOpen}
      renderPanel={(panel) => {
        const panelLookupKey = buildProductModuleLookupKey(panel.moldId, panel.moldNo);
        const panelMoldKey = normalizeMoldLookupKey(panel.moldId);
        const filteredProjects = projects.filter((project) => {
          const moldNumber = project.identity?.moldNumber?.trim() || '';
          return normalizeMoldLookupKey(moldNumber) === panelMoldKey;
        });

        const filteredProductDataByMold =
          Object.fromEntries(
            Object.entries(productDataByMold).filter(([lookupKey, record]) => {
              if (lookupKey === panelLookupKey) return true;
              return normalizeMoldLookupKey(record.moldNumber) === panelMoldKey;
            }),
          );

        return (
          <ProductDataWorkspace
            projects={filteredProjects}
            theme={theme}
            productDataByMold={filteredProductDataByMold}
            productSequenceByMold={productSequenceByMold}
          />
        );
      }}
    />
  );
}
