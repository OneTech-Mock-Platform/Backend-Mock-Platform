export type SpecWarning = { code: string; message: string };

export function detectEndpointWarnings(details: {
  requestBody?: { schema?: any } | null;
  parameters?: { name: string }[];
  responses?: { statusCode: string; description: string }[];
  accessControl?: { resource?: string; privilege?: string } | null;
} | null | undefined): SpecWarning[] {
  const warnings: SpecWarning[] = [];
  if (!details) return warnings;

  const hasInput = !!details.requestBody?.schema || (details.parameters?.length ?? 0) > 0;
  const nonSuccessCodes = (details.responses ?? [])
    .map((r) => r.statusCode)
    .filter((code) => !['200', '201', '202', '204'].includes(code));
  if (!hasInput && nonSuccessCodes.length > 0) {
    warnings.push({
      code: 'NO_INPUT_WITH_ERROR_RESPONSES',
    message: `Spec incomplète : aucun paramètre d'entrée déclaré, mais ${nonSuccessCodes.length} réponse(s) d'erreur documentée(s) (${nonSuccessCodes.join(', ')}). Ces scénarios ne peuvent pas être fiables sans savoir quelles entrées existent réellement.`,
    });
  }

  if (details.responses?.some((r) => r.statusCode === '403') && !details.accessControl) {
    warnings.push({
      code: 'FORBIDDEN_WITHOUT_ACCESS_CONTROL',
      message: `Un 403 est déclaré sans information de droits pour expliquer pourquoi l'accès serait refusé.`,
    });
  }

  return warnings;
}
