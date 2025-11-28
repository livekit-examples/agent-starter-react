import * as fs from 'node:fs';
import * as path from 'node:path';

export function getComponentNames() {
  const componentsDir = path.join(process.cwd(), 'components/demos');
  const componentNames = fs.readdirSync(componentsDir);
  return componentNames
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => file.replace('.tsx', ''));
}
