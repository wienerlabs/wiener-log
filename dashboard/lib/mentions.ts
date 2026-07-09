export function parseMentions(body: string): string[] {
  const set = new Set<string>();
  const re = /(?:^|[^a-zA-Z0-9/])@([a-zA-Z0-9][a-zA-Z0-9-]{0,38})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) set.add(m[1].toLowerCase());
  return [...set];
}

export function parseProjects(body: string): string[] {
  const set = new Set<string>();
  const re = /(?:^|\s)#([a-zA-Z0-9._-]{1,60})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) set.add(m[1]);
  return [...set];
}
