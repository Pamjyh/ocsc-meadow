export type CommandGroup = 'ควบคุมเร็ว' | 'นำทาง' | 'คลังเนื้อหา' | 'ชุดข้อสอบ';

export interface CommandItem {
  id: string;
  group: CommandGroup;
  icon: string;
  title: string;
  subtitle?: string;
  keywords?: string;
  shortcut?: string;
  run: () => void;
}

export function filterCommandItems(
  items: readonly CommandItem[],
  rawQuery: string,
): CommandItem[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    // Show quick controls + navigation + first few studies/exams when empty so the list feels crisp
    const core = items.filter(
      (i) => i.group === 'นำทาง' || i.group === 'ควบคุมเร็ว',
    );
    const studies = items.filter((i) => i.group === 'คลังเนื้อหา').slice(0, 4);
    const exams = items.filter((i) => i.group === 'ชุดข้อสอบ').slice(0, 4);
    return [...core, ...studies, ...exams];
  }

  const terms = query.split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    const haystack = `${item.title} ${item.subtitle ?? ''} ${item.keywords ?? ''} ${item.group}`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}
