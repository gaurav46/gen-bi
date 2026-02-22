export const DESCRIPTION_SUGGESTION_PORT = 'DESCRIPTION_SUGGESTION_PORT';

export interface DescriptionSuggestionPort {
  suggestDescriptions(
    columns: {
      tableName: string;
      columnName: string;
      dataType: string;
      neighborColumns: string[];
    }[],
  ): Promise<{ columnName: string; tableName: string; description: string }[]>;
}
