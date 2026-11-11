import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataPane } from '@/features/data/DataPane';
import { EditorPane } from '@/features/editor/EditorPane';
import { ToolsPane } from '@/features/tools/ToolsPane';
import { type PanelTab, useStudio } from '@/state/studio';

/** tabs.json#TabsDemo. Panels stay mounted so editor history and form input survive tab switches. */
export function SidePanel() {
  const { tab, setTab, panelWidth } = useStudio();
  return (
    <aside className="bg-surface-primary flex min-h-0 shrink-0 flex-col" style={{ width: panelWidth }} aria-label="Panel">
      <Tabs value={tab} onValueChange={v => setTab(v as PanelTab)} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="shrink-0 px-2">
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>
        <TabsContent value="editor" keepMounted className="min-h-0 flex-1 py-0 data-[hidden]:hidden">
          <EditorPane />
        </TabsContent>
        <TabsContent value="data" keepMounted className="min-h-0 flex-1 overflow-y-auto py-0 data-[hidden]:hidden">
          <DataPane />
        </TabsContent>
        <TabsContent value="tools" keepMounted className="min-h-0 flex-1 overflow-y-auto py-0 data-[hidden]:hidden">
          <ToolsPane />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
