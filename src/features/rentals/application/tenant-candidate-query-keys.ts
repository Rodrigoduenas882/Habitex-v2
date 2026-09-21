export const tenantCandidateQueryKeys = {
  list: (administrationId: string) => ['administration', administrationId, 'tenant-candidates'] as const,
}
