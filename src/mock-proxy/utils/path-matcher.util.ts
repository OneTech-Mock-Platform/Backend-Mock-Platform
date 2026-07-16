export function pathToRegex(openApiPath: string): RegExp {
  const pattern = openApiPath
    .split('/')
    .map((segment) =>
      segment.startsWith('{') && segment.endsWith('}')
        ? '([^/]+)'
        : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('/');
  return new RegExp(`^${pattern}/?$`, 'i');
}

export function countDynamicSegments(openApiPath: string): number {
  return openApiPath.split('/').filter((s) => s.startsWith('{') && s.endsWith('}')).length;
}
