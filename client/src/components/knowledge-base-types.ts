export interface KnowledgeRecord {
  id: string;
  date: string;
  defectIndex: string;
  defectType: 'MOLD' | 'PROCESS' | 'MATERIAL';
  countermeasure: string;
  hasAttachment: boolean;
  submittedBy: string;
}
